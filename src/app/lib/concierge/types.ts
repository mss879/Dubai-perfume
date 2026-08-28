/**
 * The concierge wire format — everything the chat widget and /api/concierge
 * agree on. Plain module on purpose: the client imports these types, so
 * nothing here may pull in server-only code (or any code at all — types only).
 *
 * The one rule that matters: every product fact the browser renders (cards,
 * stage, cart actions) is resolved SERVER-SIDE from the database snapshot.
 * The model only ever names product ids; the server decides what they are
 * called and what they cost — the same stance /api/quiz takes with its email.
 */

export type ConciergeRole = "user" | "assistant";

export type ConciergeHistoryMessage = {
  role: ConciergeRole;
  content: string;
};

/**
 * One photograph, attached to the LATEST user turn only.
 *
 * It never enters `messages`: replaying an image through the history would be
 * paid for on every subsequent turn, and the model would re-identify a bottle
 * it already named. What it read survives as text instead — see `photoReading`.
 */
export type ConciergeImage = {
  mediaType: "image/jpeg";
  /** Base64, no data: prefix. The route caps the length before it is trusted. */
  data: string;
};

/**
 * A photograph the browser has already downscaled — what to send, and what to
 * show while sending it. The thumbnail never leaves the browser.
 */
export type ConciergePreparedImage = {
  /** What goes on the wire. */
  image: ConciergeImage;
  /** A small data: URL for the composing preview and the transcript bubble. */
  thumb: string;
};

/** What the widget POSTs to /api/concierge. */
export type ConciergeRequest = {
  /** UUID minted by the browser, kept in localStorage across pages. */
  sessionId: string;
  /** The visible transcript. The server clamps length and sizes. */
  messages: ConciergeHistoryMessage[];
  /** Current pathname, e.g. "/product/42" — lets the agent see the shelf. */
  page?: string;
  /** Product ids the shopper viewed this session (browse tracking, ≤12). */
  viewedProductIds?: number[];
  /**
   * Ids the shopper added by tapping ADD on a staged card since the last turn.
   * Analytics only — it is how "shown" becomes "shown AND taken". The server
   * drops any id the catalogue does not know and renders nothing from them.
   */
  tappedProductIds?: number[];
  /**
   * The bag total as the browser sees it. ADVISORY: clamped on arrival and used
   * only so the agent can say "another AED 15 and delivery is free". Money is
   * still decided by place_order, which recomputes everything from the cart.
   */
  cartSubtotalAed?: number;
  /** One photograph, or none. */
  image?: ConciergeImage;
  /** Honeypot. Hidden field; only bots fill it. */
  company?: string;
};

/** One size's availability, as the agent may repeat it. */
export type ConciergeStockRow = {
  size: string;
  level: number;
  /** True when the store itself would call this low (≤ its own threshold). */
  low: boolean;
};

/** A product as displayed in the chat — server-resolved, never model-authored. */
export type ConciergeCard = {
  id: number;
  brand: string;
  name: string;
  priceAed: number;
  /**
   * The house list price, for the struck-through figure. null when the row has
   * none. Display only — ConciergeAction carries priceAed alone, because a bag
   * line is a transaction.
   */
  compareAtAed: number | null;
  image: string;
  sizes: string[];
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  tagline: string;
  /** null = stock was not checked this turn; the card stays quiet about it. */
  stock: ConciergeStockRow[] | null;
};

export type StageQuestionOption = {
  value: string;
  label: string;
  hint?: string;
};

/** A scent-builder question the agent stages as tappable tiles. */
export type StageQuestion = {
  id: string;
  prompt: string;
  options: StageQuestionOption[];
  allowMultiple?: boolean;
};

/** One step of an order's journey, as the stage draws it. */
export type ConciergeOrderEvent = {
  status: string;
  location: string | null;
  description: string | null;
  updatedAt: string | null;
};

/** A line of an order, named so the agent can talk about what someone owns. */
export type ConciergeOrderItem = {
  productId: number | null;
  name: string;
  size: string;
  quantity: number;
};

/**
 * A looked-up order, as the stage renders it.
 *
 * Deliberately narrower than track_guest_order's payload: no email, no phone,
 * no shipping address. The shopper proved who they are to see this; the model
 * never does — only the item names reach it, so "what pairs with these?" works.
 */
export type ConciergeOrderView = {
  orderId: string;
  status: string;
  placedAt: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: ConciergeOrderItem[];
  events: ConciergeOrderEvent[];
};

/** What the top zone of the chat window is showing. */
export type ConciergeStage =
  | { kind: "products"; products: ConciergeCard[] }
  | { kind: "question"; question: StageQuestion }
  /**
   * The secure order-lookup form. Carries NO order number and NO email — the
   * shopper types those into the browser, which posts them to a dedicated
   * endpoint. Neither ever reaches the model's context or the transcript.
   */
  | { kind: "order_lookup"; prefillOrderRef?: string };

/**
 * A side effect the widget performs on the shopper's behalf. Only ever built
 * by the server from validated tool calls — the widget must not execute
 * anything the model wrote as prose.
 */
export type ConciergeAction = {
  type: "add_to_cart";
  product: { id: number; brand: string; name: string; priceAed: number; image: string };
  size: string;
  quantity: number;
};

/** What /api/concierge answers. */
export type ConciergeResponse = {
  ok: boolean;
  /** Plain text; blank-line separated paragraphs. No markdown. */
  content?: string;
  /** What to put on the stage, or null to leave it as it was. */
  stage?: ConciergeStage | null;
  /** Quick-reply chips, ≤4. */
  suggestions?: string[];
  /** Cart effects to run client-side, ≤3. */
  actions?: ConciergeAction[];
  /**
   * A code the customer accepted this turn. The widget parks it for checkout
   * rather than applying it — the shopper still presses Apply themselves, and
   * place_order is still the only thing that redeems anything.
   */
  offerCode?: string;
  /** What the agent read out of a photograph — the conversation's memory of it. */
  photoReading?: string;
  /** Friendly copy when ok is false. Never internal detail. */
  error?: string;
};

/** What the browser POSTs to /api/concierge/order. Never touches the model. */
export type ConciergeOrderLookupRequest = {
  sessionId: string;
  orderRef: string;
  email: string;
  /** Honeypot. Hidden field; only bots fill it. */
  company?: string;
};

/** What /api/concierge/order answers. */
export type ConciergeOrderLookupResponse = {
  ok: boolean;
  order?: ConciergeOrderView;
  /** Friendly copy when ok is false. Never internal detail. */
  error?: string;
};
