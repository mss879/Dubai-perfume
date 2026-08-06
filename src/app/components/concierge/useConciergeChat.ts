"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { addToCart, cartSubtotal, readCart } from "../../lib/cart";
import { stashOfferCode } from "../../lib/offer-code";
import { openCartDrawer } from "../CartDrawer";
import type {
  ConciergeAction,
  ConciergeHistoryMessage,
  ConciergeOrderLookupResponse,
  ConciergeOrderView,
  ConciergePreparedImage,
  ConciergeResponse,
  ConciergeStage,
} from "../../lib/concierge/types";
import { readViewedProductIds } from "./useConciergeNudges";
import { ORDER_CHIPS, orderSummaryLine } from "./StageOrderLookup";

/**
 * The conversation state behind the concierge window.
 *
 * Persisted to localStorage (`gharib_concierge_v1`) the same way the bag is
 * (`gharib_cart_v2`): a concierge who forgets the conversation between the
 * shop page and the product page is useless as a sales agent. The transcript
 * carries each reply's stage payload too, so a past exhibit can be restored
 * with a tap, and the whole thing expires after a day — yesterday's
 * conversation reopening mid-sentence would be stranger than starting fresh.
 *
 * Cart effects arrive as server-resolved actions on the response envelope and
 * are executed here — never parsed out of model prose.
 */

const STORAGE_KEY = "gharib_concierge_v1";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 30;
/** How much transcript rides to the server. It clamps again regardless. */
const MAX_SENT_MESSAGES = 12;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stage?: ConciergeStage | null;
  suggestions?: string[];
  /** A reply that never arrived — rendered as an apology with a retry. */
  failed?: boolean;
  /** This user turn carried a photograph. */
  hasImage?: boolean;
  /** A small data: URL of that photograph. Browser-only; never sent. */
  thumb?: string;
  /** What the agent read out of the photograph, on the reply to it. */
  photoReading?: string;
};

export type ChatStatus = "idle" | "sending";

const FAILED_COPY = "The concierge could not reply just now.";

/** What a photograph sent on its own means. Never shown; only sent. */
const PHOTO_ONLY_CAPTION = "Do you have this, or something like it?";

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

type Stored = {
  sessionId: string;
  messages: ChatMessage[];
  stage: ConciergeStage | null;
  savedAt: number;
};

function readStored(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof parsed.sessionId !== "string" ||
      !Array.isArray(parsed.messages) ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > STORAGE_TTL_MS
    ) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      messages: parsed.messages.filter(
        (m): m is ChatMessage =>
          Boolean(m) &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      ),
      stage: parsed.stage ?? null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function useConciergeChat() {
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState<ConciergeStage | null>(null);
  /** Mirror for callbacks — send() must see the stage as it is NOW. */
  const stageRef = useRef<ConciergeStage | null>(null);
  const [status, setStatus] = useState<ChatStatus>("idle");
  /** A one-line confirmation strip ("Added to your bag"), self-dismissing. */
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * A looked-up order, held beside the stage rather than inside it — and
   * deliberately NOT persisted. Someone else picking up the same phone tomorrow
   * should not find a stranger's delivery still on the display.
   */
  const [orderView, setOrderView] = useState<ConciergeOrderView | null>(null);
  /**
   * Ids the shopper tapped ADD on since the last message went out. Read and
   * cleared by send(); a ref, not state, because a tap must never re-render the
   * conversation — it only needs to be true by the time the next turn is sent.
   */
  const tappedIdsRef = useRef<number[]>([]);

  // Hydrate once, client-side — the SSR pass renders nothing stateful.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setSessionId(stored.sessionId);
      setMessages(stored.messages);
      // A stored lookup form comes back empty, and the timeline it produced was
      // never stored at all — so restoring it would show a blank form where the
      // shopper last saw their delivery. Better to show the vitrine.
      setStage(stored.stage?.kind === "order_lookup" ? null : stored.stage);
    } else {
      setSessionId(newId());
    }
    setHydrated(true);
  }, []);

  // Persist on every change, failed turns stripped.
  useEffect(() => {
    if (!hydrated || !sessionId) return;
    try {
      const stored: Stored = {
        sessionId,
        messages: messages.filter((m) => !m.failed).slice(-MAX_STORED_MESSAGES),
        stage,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage full or blocked — the conversation just becomes per-page.
    }
  }, [hydrated, sessionId, messages, stage]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  /**
   * Chips when the model offered none. Always about what is actually on the
   * table: the products on the stage first — even if THIS reply staged
   * nothing, the customer is still looking at them — and the generic openers
   * only for a conversation with nothing on display. Distraction loses sales.
   */
  const fallbackSuggestions = useCallback((incoming: ConciergeStage | null): string[] => {
    const s = incoming ?? stageRef.current;
    // A question's tiles and a lookup form's fields are the reply. Chips beside
    // them would just be a way to abandon what was asked for.
    if (s?.kind === "question" || s?.kind === "order_lookup") return [];
    if (s?.kind === "products" && s.products.length > 0) {
      const first = s.products[0];
      return s.products.length === 1
        ? [`Add ${first.name} to my bag`, "What are its notes?", "Show me similar scents"]
        : [`Add ${first.name} to my bag`, "Compare these for me", "Which lasts longest?"];
    }
    return ["Build my scent profile", "What are your bestsellers?", "Something for a gift"];
  }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }, []);

  /**
   * The one add-to-bag path — used by both agent actions and card buttons.
   *
   * `source` separates the two for the record: an agent add is the agent
   * closing, a stage tap is the shopper deciding for themselves off something
   * it put in front of them. Both are wins; only one is the agent's. It is
   * defaulted so the card buttons can keep passing `onAdd={performAdd}` bare.
   */
  const performAdd = useCallback(
    (
      product: ConciergeAction["product"],
      size: string,
      quantity = 1,
      source: "stage" | "agent" = "stage"
    ) => {
      addToCart(
        {
          id: product.id,
          brand: product.brand,
          name: product.name,
          price: product.priceAed,
          image_url: product.image,
        },
        size,
        quantity
      );
      if (source === "stage") tappedIdsRef.current.push(product.id);
      showNotice("Added to your bag");
      // No-op on pages without the shared drawer (the homepage has its own);
      // the header badge still updates via the gharib:cart event.
      openCartDrawer();
    },
    [showNotice]
  );

  const runActions = useCallback(
    (actions: ConciergeAction[] | undefined) => {
      for (const action of (actions ?? []).slice(0, 3)) {
        if (action?.type === "add_to_cart" && action.product && action.size) {
          performAdd(action.product, action.size, action.quantity ?? 1, "agent");
        }
      }
    },
    [performAdd]
  );

  /** Appends a canned assistant turn — greetings and nudge openers. Free. */
  const addAssistantLocal = useCallback((content: string, suggestions?: string[]) => {
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "assistant", content, suggestions },
    ]);
  }, []);

  const send = useCallback(
    async (rawText: string, attachment?: ConciergePreparedImage | null) => {
      // A shorter slice when a photograph rides along: the bracketed note that
      // records it is appended below, and the server clamps user turns at 1000
      // characters — at the full length that clamp would sever the note itself.
      const text = rawText.trim().slice(0, attachment ? 950 : 1000);
      if ((!text && !attachment) || status === "sending") return;

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
        ...(attachment ? { hasImage: true, thumb: attachment.thumb } : {}),
      };
      // A failed turn is replaced by the retry, not kept alongside it.
      setMessages((prev) => [...prev.filter((m) => !m.failed), userMessage]);
      setStatus("sending");

      // The transcript shows only each reply's prose, but the model needs to
      // remember what its replies STAGED — otherwise a tapped option label
      // ("Occasion") or "add the first one" arrives with no referent. The
      // trace is appended to the sent copy only; the display stays clean.
      const toServerContent = (m: ChatMessage): string => {
        let content = m.content;
        if (m.role === "assistant" && m.stage?.kind === "question") {
          content += `\n[You asked this with tappable options: ${m.stage.question.options.map((o) => o.label).join(" | ")}]`;
        }
        if (m.role === "assistant" && m.stage?.kind === "products") {
          content += `\n[You showed, in order: ${m.stage.products.map((p) => `#${p.id} ${p.brand} ${p.name}`).join("; ")}]`;
        }
        if (m.role === "assistant" && m.stage?.kind === "order_lookup") {
          content +=
            "\n[You put the secure order-lookup form on the display. You cannot see the customer's email or their order.]";
        }
        // The photograph itself rides only on the turn it was taken; what the
        // agent read out of it has to survive in words, or the next message
        // arrives with no idea which bottle "that one" means.
        if (m.role === "user" && m.hasImage) {
          // Sent with no caption, the bracketed note would be the entire user
          // message — and the prompt tells the model those are private notes to
          // itself, not something to answer. Give it the question the shopper
          // plainly meant by sending a bottle at all.
          if (!content.trim()) content = PHOTO_ONLY_CAPTION;
          content += "\n[The customer attached a photograph here.]";
        }
        if (m.role === "assistant" && m.photoReading) {
          content += `\n[You read the photograph as: ${m.photoReading}]`;
        }
        return content.slice(0, 2500);
      };

      // A photograph with no caption is still a turn. The filter runs on the
      // RAW content, before toServerContent has appended its bracketed note, so
      // testing content alone silently dropped the whole turn — the history then
      // ended on an assistant message, the server rejected it as malformed, and
      // every caption-less photograph failed.
      const history: ConciergeHistoryMessage[] = [...messages, userMessage]
        .filter((m) => !m.failed && (m.content.trim() || m.hasImage))
        .slice(-MAX_SENT_MESSAGES)
        .map((m) => ({ role: m.role, content: toServerContent(m) }));

      // Read and clear together, right before the fetch: anything tapped while
      // this request is in flight belongs to the NEXT turn, not this one.
      const tappedProductIds = tappedIdsRef.current.slice(-12);
      tappedIdsRef.current = [];

      try {
        const response = await fetch("/api/concierge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            messages: history,
            page: pathname,
            viewedProductIds: readViewedProductIds(),
            tappedProductIds,
            // Read fresh rather than held in state: the bag can change from the
            // cart drawer while the concierge window is open.
            cartSubtotalAed: cartSubtotal(readCart()),
            image: attachment?.image,
            company: "",
          }),
        });
        const data = (await response.json()) as ConciergeResponse;

        if (!response.ok || !data.ok || !data.content) {
          throw new Error(data.error || FAILED_COPY);
        }

        const suggestions =
          data.suggestions && data.suggestions.length > 0
            ? data.suggestions
            : fallbackSuggestions(data.stage ?? null);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: data.content ?? "",
            stage: data.stage ?? null,
            suggestions,
            ...(data.photoReading ? { photoReading: data.photoReading } : {}),
          },
        ]);
        if (data.stage) {
          setStage(data.stage);
          // Whatever the agent stages next retires the timeline. Leaving it up
          // beneath a new exhibit is how a stale delivery ends up on screen.
          setOrderView(null);
        }
        // Parked, never applied — the shopper still presses Apply at checkout.
        if (data.offerCode) {
          stashOfferCode(data.offerCode);
          showNotice("Code saved for checkout");
        }
        runActions(data.actions);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: err instanceof Error && err.message ? err.message : FAILED_COPY,
            failed: true,
          },
        ]);
      } finally {
        setStatus("idle");
      }
    },
    [messages, pathname, runActions, sessionId, status, fallbackSuggestions, showNotice]
  );

  /**
   * Re-sends the last user message after a failed reply.
   *
   * A photograph is deliberately not re-sent: the file is long gone from the
   * composer by now, and a retry that silently drops the attachment is kinder
   * than one that fails again for the same reason.
   */
  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const withoutFailure = prev.filter((m) => !m.failed);
      // Drop the user turn too; send() will append it again.
      const lastIndex = withoutFailure.map((m) => m.id).lastIndexOf(lastUser.id);
      return lastIndex >= 0 ? withoutFailure.slice(0, lastIndex) : withoutFailure;
    });
    void send(lastUser.content);
  }, [messages, send]);

  /** Wipes the conversation and rotates the session id. */
  const startOver = useCallback(() => {
    setMessages([]);
    setStage(null);
    setOrderView(null);
    tappedIdsRef.current = [];
    setSessionId(newId());
    setStatus("idle");
  }, []);

  /** Clears a looked-up order without disturbing the conversation. */
  const resetOrderView = useCallback(() => setOrderView(null), []);

  /**
   * Look up an order from the form on the stage.
   *
   * Deliberately NOT routed through send(): the order number and the email go
   * to their own endpoint and never join the transcript, so the model never
   * sees either. What it gets is the local assistant turn appended afterwards,
   * which names the order and what is in it — enough to keep talking, nothing
   * that identifies anyone.
   */
  const lookupOrder = useCallback(
    async (orderRef: string, email: string) => {
      const response = await fetch("/api/concierge/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, orderRef, email, company: "" }),
      });
      const data = (await response.json()) as ConciergeOrderLookupResponse;
      if (!response.ok || !data.ok || !data.order) {
        throw new Error(data.error || "No order found for that reference and email.");
      }
      setOrderView(data.order);
      addAssistantLocal(orderSummaryLine(data.order), ORDER_CHIPS);
    },
    [sessionId, addAssistantLocal]
  );

  return {
    hydrated,
    messages,
    stage,
    setStage,
    status,
    notice,
    orderView,
    send,
    retry,
    startOver,
    lookupOrder,
    resetOrderView,
    performAdd,
    addAssistantLocal,
  };
}
