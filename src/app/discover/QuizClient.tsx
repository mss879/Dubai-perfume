"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { useCart } from "../lib/cart";
import { useCurrency } from "../lib/currency";
import { openCartDrawer } from "../components/CartDrawer";
import FinderIntro from "./FinderIntro";
import { AXES, AXIS_LABELS, type Axis } from "../lib/scent-wheel";
import {
  QUIZ_QUESTIONS,
  chosenOption,
  readerProfile,
  recommend,
  type QuizAnswers,
  type QuizMatch,
  type ScoredProduct,
} from "../lib/quiz";

/**
 * The fragrance finder, as an experience.
 *
 * Scoring runs here, against profiles the server derived — four round trips is
 * four chances to lose someone who is only half curious, so an answer lands the
 * instant it is tapped.
 *
 * ── On the photography ───────────────────────────────────────────────────────
 *
 * Each result carries its catalogue image, same as the shop grid — for now that
 * is the placeholder bottle, and real photography slots in with no change here.
 * The note pyramid stays alongside it as the argument for the match: head,
 * heart and base set as type, with the notes that earned the match struck in
 * black and the rest left grey — the shopper is buying the composition, not
 * the glass.
 */

const HAIRLINE = "rgba(0,0,0,0.12)";

/**
 * Each axis, coloured and drawn as the MATERIALS it is made of.
 *
 * The tone is taken from the raw material itself rather than chosen to look
 * pleasant: bergamot peel and sea for fresh, the rose for floral, vanilla and
 * praline for sweet, fossilised resin for amber, oud and sandalwood for woody,
 * saffron threads for spice. That is why amber and sweet sit close on the wheel
 * yet read differently here — vanilla is cream, amber resin is burnt gold, and
 * the eye should learn the same relationship the nose does.
 *
 * `ink` is the darker variant, used wherever the tone carries TEXT — the pale
 * vanilla that is right for a 3px bar is unreadable as a numeral on white.
 *
 * The mark beside each axis is an engraved botanical plate of the material —
 * the visual language perfumery has always used for its raw materials, and the
 * one thing that sits right next to serif type and hairlines. Two directions
 * were tried and rejected before it: a general-purpose icon set has no
 * vocabulary here (its "amber" is the fossilised gemstone, which perfumery
 * amber has nothing to do with, and its only timber is a conifer, which reads
 * as a Christmas tree beside a row meaning oud); and literal macro photographs
 * of the ingredients read as a spice merchant rather than a maison.
 *
 * The plates are in `public/marks`, and they are BLACK INK ON WHITE, shown with
 * `mix-blend-mode: multiply` so the paper drops out over whatever the panel
 * background happens to be. That is deliberate — cutting an alpha channel on a
 * brightness threshold leaves grey fringing along every hatch line, whereas
 * multiply keeps the hatching intact. Their whites were flattened to a true 255
 * when they were prepared; if a mark is ever replaced, its paper must be
 * normalised the same way or it will print a grey square on the panel.
 *
 * So colour lives in the bars and the type, and the marks stay in ink. The rest
 * of the page is monochrome; this panel is the one place the finder is allowed
 * a palette, because it is the one thing on it that genuinely is six different
 * materials.
 */
const AXIS_READINGS: Record<
  Axis,
  { tone: string; ink: string; notes: string; plate: string; alt: string }
> = {
  fresh: {
    tone: "#5F9E86",
    ink: "#3F7A64",
    notes: "bergamot, sea salt and mint",
    plate: "/marks/fresh.png",
    alt: "Engraving of a bergamot, cut across",
  },
  floral: {
    tone: "#C57F98",
    ink: "#A85C77",
    notes: "rose, jasmine and orange blossom",
    plate: "/marks/floral.png",
    alt: "Engraving of a damask rose in bloom",
  },
  sweet: {
    tone: "#E0B871",
    ink: "#AC8235",
    notes: "vanilla, praline and tonka",
    plate: "/marks/sweet.png",
    alt: "Engraving of vanilla pods",
  },
  amber: {
    tone: "#BB6B22",
    ink: "#98551A",
    notes: "labdanum, incense and benzoin",
    plate: "/marks/amber.png",
    alt: "Engraving of resin tears",
  },
  woody: {
    tone: "#6E5340",
    ink: "#57402F",
    notes: "oud, sandalwood and cedar",
    plate: "/marks/woody.png",
    alt: "Engraving of split oud wood",
  },
  spice: {
    tone: "#AC3F2B",
    ink: "#8C3220",
    notes: "saffron, cardamom and pepper",
    plate: "/marks/spice.png",
    alt: "Engraving of a saffron crocus",
  },
};

type Stage = "intro" | "question" | "composing" | "results";
type CaptureStatus = "idle" | "sending" | "sent" | "error";

/** What the interstitial says while the finder works. */
const COMPOSING_LINES = [
  "Reading your answers",
  "Weighing the note pyramids",
  "Placing you on the fragrance wheel",
  "Naming your three",
];

/* ── Small pieces ────────────────────────────────────────────────────────── */

/** The segment rail across the top of every question — one segment each. */
function ProgressRail({ index, total }: { index: number; total: number }) {
  return (
    <div className="mx-auto flex max-w-[420px] items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-px flex-1 overflow-hidden" style={{ background: HAIRLINE }}>
          <motion.div
            className="h-full bg-black"
            initial={false}
            animate={{ width: i < index ? "100%" : i === index ? "100%" : "0%" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ opacity: i === index ? 1 : i < index ? 0.35 : 0 }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * A number that counts up to its value. The match percentage.
 *
 * The count is decoration; the figure is CONTENT. requestAnimationFrame does
 * not run in a hidden tab, so an animation left to itself would leave a shopper
 * looking at "0%" — a wrong number, not merely an unanimated one. Hence the
 * guarantee below: a timer (which does still fire when frames do not) snaps the
 * figure to its true value if the frames never arrive.
 */
function CountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const reduced = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (reduced) return;
    // No reset of `settled` here: each card mounts with its own final figure
    // and `to` never changes underneath it, so there is nothing to re-run.
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast at first, settling gently on the final figure.
      setAnimated(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setSettled(true);
    };
    frame = requestAnimationFrame(tick);

    // The backstop. Generous enough never to cut a real animation short.
    const failsafe = setTimeout(() => setSettled(true), duration + 400);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(failsafe);
    };
  }, [to, duration, reduced]);

  // Derived rather than synchronised: with motion reduced, or once the count
  // has finished or timed out, the true figure is simply what renders.
  return <>{reduced || settled ? to : animated}</>;
}

/**
 * The shopper's own reading, as six animated bars.
 *
 * Each axis carries its own tone, and the strongest two are named underneath in
 * words — a shopper should be able to take the meaning without decoding a
 * chart. The bar is drawn as a tinted track with a gradient fill and a marker
 * at the tip, which reads as an instrument rather than a progress bar.
 */
function ProfileBars({
  profile,
  delay = 0,
}: {
  profile: Record<Axis, number>;
  delay?: number;
}) {
  // One column at every width. Two columns halves the track length, and a bar
  // too short to see the difference between 6 and 8 is a decoration rather
  // than a reading.
  return (
    <div className="flex flex-col gap-5">
      {AXES.map((axis, i) => {
        const value = profile[axis];
        const { tone, ink, notes, plate, alt } = AXIS_READINGS[axis];
        // The true position, with NO minimum. A floor here would draw a bar on
        // an axis reading 0.0 and put the marker a few percent along, which
        // contradicts the figure beside it — and a zero is meaningful: it is
        // usually the axis the shopper asked us to keep away from.
        const percent = (value / 10) * 100;
        // Below the midpoint the axis is barely present in what they asked for,
        // so it recedes to grey rather than claiming a colour it has not earned.
        const present = value >= 5;
        return (
          <div key={axis} className="flex items-center gap-4" title={`${AXIS_LABELS[axis]} — ${notes}`}>
            {/* multiply drops the paper out; an axis the shopper is not asking
                for fades rather than greys, so the engraving keeps its detail */}
            {/* Asked for at 80 and shown at 40: engraved hatching falls apart
                at 1x on a retina screen. */}
            <Image
              src={plate}
              alt={alt}
              width={80}
              height={80}
              className="h-[40px] w-[40px] shrink-0 transition-opacity duration-500"
              style={{ mixBlendMode: "multiply", opacity: present ? 1 : 0.32 }}
            />

            <span
              className="w-[54px] shrink-0 text-[11px] uppercase tracking-[0.14em] transition-colors duration-500"
              style={{ color: present ? "#2B2B2B" : "#8A8A8A" }}
            >
              {AXIS_LABELS[axis]}
            </span>

            <div className="relative flex-1">
              {/* The track, tinted in the axis's own tone so an empty axis is
                  still legible as that material rather than as absence. */}
              <div
                className="h-[3px] w-full overflow-hidden rounded-full"
                style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)` }}
              >
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 1, delay: delay + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: `linear-gradient(90deg, color-mix(in srgb, ${tone} 45%, transparent) 0%, ${tone} 100%)`,
                  }}
                />
              </div>

              {/* The tip. Sits on the end of the fill and arrives with it. */}
              <motion.span
                aria-hidden="true"
                className="absolute top-1/2 block h-[7px] w-[7px] -translate-y-1/2 rounded-full"
                initial={{ left: 0, opacity: 0 }}
                animate={{ left: `${percent}%`, opacity: 1 }}
                transition={{ duration: 1, delay: delay + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: tone,
                  marginLeft: -3.5,
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${tone} 15%, transparent)`,
                }}
              />
            </div>

            <span
              className="w-[22px] shrink-0 text-right text-[11px] tabular-nums transition-colors duration-500"
              style={{ color: present ? ink : "#C4C4C4" }}
            >
              {value.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The profile said in words — the two axes that lead, named.
 *
 * A chart nobody can read is decoration. This is the sentence version of the
 * bars above it, and it is what most shoppers will actually take away.
 */
function ProfileSummary({ profile }: { profile: Record<Axis, number> }) {
  const ranked = [...AXES].sort((a, b) => profile[b] - profile[a]);
  const [lead, second] = ranked;
  if (profile[lead] < 1) return null;

  const leadRead = AXIS_READINGS[lead];
  const secondRead = AXIS_READINGS[second];

  return (
    <p
      className="mt-9 border-t pt-7 text-center text-[13px] font-light leading-[1.8] text-[#646464]"
      style={{ borderColor: HAIRLINE }}
    >
      Your reading leans{" "}
      <span className="font-normal" style={{ color: leadRead.ink }}>
        {AXIS_LABELS[lead].toLowerCase()}
      </span>{" "}
      — {leadRead.notes}
      {profile[second] >= profile[lead] * 0.55 && (
        <>
          {" "}
          — with{" "}
          <span className="font-normal" style={{ color: secondRead.ink }}>
            {AXIS_LABELS[second].toLowerCase()}
          </span>{" "}
          beneath it
        </>
      )}
      .
    </p>
  );
}

/**
 * Head, heart and base — the composition set as type.
 *
 * The notes that earned the match are struck in black; the rest stay grey. That
 * is the whole visual argument for the recommendation, and it works without a
 * single photograph.
 */
function NotePyramid({
  product,
  highlighted,
}: {
  product: ScoredProduct;
  highlighted: string[];
}) {
  const marked = new Set(highlighted.map((n) => n.toLowerCase()));
  const tiers: [string, string[]][] = [
    ["Head", product.topNotes],
    ["Heart", product.heartNotes],
    ["Base", product.baseNotes],
  ];

  return (
    <dl className="mt-6 flex flex-col gap-3">
      {tiers.map(([label, notes]) =>
        notes.length === 0 ? null : (
          <div key={label} className="flex gap-4">
            <dt className="w-[42px] shrink-0 pt-[3px] text-[10px] uppercase tracking-[0.16em] text-[#9a9a9a]">
              {label}
            </dt>
            <dd className="text-[12px] leading-[1.75] text-[#646464]">
              {notes.map((note, i) => (
                <span key={`${note}-${i}`}>
                  <span className={marked.has(note.toLowerCase()) ? "text-black" : undefined}>
                    {note}
                  </span>
                  {i < notes.length - 1 && <span className="text-[#c8c8c8]"> · </span>}
                </span>
              ))}
            </dd>
          </div>
        )
      )}
    </dl>
  );
}

/* ── The finder ──────────────────────────────────────────────────────────── */

export default function QuizClient({ products }: { products: ScoredProduct[] }) {
  const reduced = useReducedMotion();

  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [matches, setMatches] = useState<QuizMatch[]>([]);
  const [composingStep, setComposingStep] = useState(0);

  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [capture, setCapture] = useState<CaptureStatus>("idle");
  const [captureError, setCaptureError] = useState<string | null>(null);

  const { add } = useCart();
  const { format } = useCurrency();
  const [added, setAdded] = useState<Set<number>>(new Set());

  /** One id per completed run, so the anonymous record and any later email
      land on the same row rather than two. */
  const sessionIdRef = useRef<string | null>(null);

  /** Scope for the question screen's GSAP timeline. */
  const questionRef = useRef<HTMLElement>(null);

  const question = QUIZ_QUESTIONS[index];
  const total = QUIZ_QUESTIONS.length;
  const catalogueEmpty = products.length === 0;

  const fade = useMemo(
    () =>
      reduced
        ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } }
        : {
            initial: { opacity: 0, y: 14 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
          },
    [reduced]
  );

  const post = useCallback(async (payload: Record<string, unknown>) => {
    try {
      return await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      return null;
    }
  }, []);

  /** Scores, then runs the interstitial before revealing anything. */
  const finish = useCallback(
    (finalAnswers: QuizAnswers) => {
      const picks = recommend(products, finalAnswers, 3);
      setMatches(picks);
      // With motion reduced the interstitial has nothing to show, so it is
      // skipped outright rather than entered and immediately left.
      setStage(reduced ? "results" : "composing");
      setComposingStep(0);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });

      try {
        sessionIdRef.current = crypto.randomUUID();
      } catch {
        sessionIdRef.current = null;
      }

      // Recorded straight away. Most people never give an address, and what
      // they chose is worth knowing on its own.
      if (sessionIdRef.current && picks.length > 0) {
        void post({
          sessionId: sessionIdRef.current,
          answers: finalAnswers,
          recommended: picks.map((m) => m.product.id),
          profile: readerProfile(finalAnswers),
        });
      }
    },
    [products, post, reduced]
  );

  /* The interstitial. Long enough to feel like work was done, short enough
     that nobody waits. Never entered when motion is reduced (see finish). */
  useEffect(() => {
    if (stage !== "composing") return;
    const timers = COMPOSING_LINES.map((_, i) =>
      setTimeout(() => setComposingStep(i), i * 420)
    );
    const done = setTimeout(() => setStage("results"), COMPOSING_LINES.length * 420 + 320);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [stage]);

  const choose = useCallback(
    (value: string) => {
      const next: QuizAnswers = { ...answers, [question.id]: value };
      setAnswers(next);
      if (index < total - 1) {
        setIndex(index + 1);
      } else {
        finish(next);
      }
    },
    [answers, question, index, total, finish]
  );

  const back = useCallback(() => {
    if (index === 0) {
      setStage("intro");
      return;
    }
    setIndex(index - 1);
  }, [index]);

  /*
   * The question screen, dealt out rather than simply drawn.
   *
   * Same rule as the opening: the cards are rendered in their final state and
   * GSAP only re-times their arrival, so a tab that never gets a frame shows a
   * complete, usable question instead of four invisible buttons.
   */
  useEffect(() => {
    if (stage !== "question") return;
    const element = questionRef.current;
    if (!element) return;
    if (reduced || document.hidden) return;

    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-ask]", { opacity: 0, y: 14, duration: 0.5, stagger: 0.06 })
        // The grid moves as one, so its hairline background is never exposed.
        .from("[data-options]", { opacity: 0, y: 16, duration: 0.5 }, "-=0.2")
        // The stagger lives here instead — the cards stay opaque throughout.
        .from(
          "[data-option-line]",
          { opacity: 0, y: 10, duration: 0.45, stagger: 0.035 },
          "-=0.25"
        )
        .from("[data-foot]", { opacity: 0, duration: 0.5 }, "-=0.3");
    }, element);

    return () => context.revert();
  }, [stage, index, reduced]);

  /* Keyboard. A finder you can run entirely from the keyboard costs almost
     nothing to build and is markedly faster to use. */
  useEffect(() => {
    if (stage !== "question") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
        e.preventDefault();
        choose(question.options[n - 1].value);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, question, choose, back]);

  const restart = () => {
    setAnswers({});
    setMatches([]);
    setIndex(0);
    setStage("intro");
    setCapture("idle");
    setCaptureError(null);
    setEmail("");
    setAdded(new Set());
    sessionIdRef.current = null;
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Jump back to one question from the answer summary. */
  const revisit = (questionIndex: number) => {
    setIndex(questionIndex);
    setStage("question");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sendResults = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    if (!address || capture === "sending") return;

    setCapture("sending");
    setCaptureError(null);

    const res = await post({
      sessionId: sessionIdRef.current,
      answers,
      recommended: matches.map((m) => m.product.id),
      reasons: matches.map((m) => m.reason),
      profile: readerProfile(answers),
      email: address,
      company,
    });

    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (res?.ok && json?.ok) {
      setCapture("sent");
    } else {
      setCapture("error");
      setCaptureError(json?.error || "We could not send them just now. Please try again in a moment.");
    }
  };

  const addToBag = (match: QuizMatch) => {
    const p = match.product;
    add({ id: p.id, brand: p.brand, name: p.name, price: p.price, image_url: p.image }, p.sizes[0], 1);
    setAdded((prev) => new Set(prev).add(p.id));
    openCartDrawer();
  };

  const profile = useMemo(() => readerProfile(answers), [answers]);

  /** The chips under the results — every answer, clickable to change. */
  const answerChips = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {QUIZ_QUESTIONS.map((q, i) => {
        const option = chosenOption(q, answers);
        if (!option) return null;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => revisit(i)}
            className="border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-[#646464] transition-colors duration-300 hover:border-black hover:text-black cursor-pointer"
            style={{ borderColor: HAIRLINE }}
            title={`Change: ${q.prompt}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  /**
   * ONE key for the whole flow. Changing it remounts the stage, which is what
   * plays the entrance animation.
   *
   * There is deliberately NO AnimatePresence and no exit animation here, and
   * that is a correctness decision rather than a stylistic one.
   *
   * `AnimatePresence mode="wait"` holds the outgoing stage on screen until its
   * exit animation reports finished, and only then mounts the incoming one.
   * Exit animations are driven by requestAnimationFrame, and rAF does not run
   * in a hidden tab — so a shopper who answers a question and immediately
   * switches tab leaves the finder frozen mid-fade, showing the question they
   * have already answered, until they come back. It self-heals on return, but
   * a state machine that can wedge on an animation is the wrong shape: the
   * stage must change the instant the answer is given, whether or not anything
   * is animating.
   *
   * Fading the new stage IN has no such dependency — if the frames never come,
   * it simply appears.
   */
  const stageKey = stage === "question" ? `question-${index}` : stage;

  return (
    <div>
      <motion.div
        key={stageKey}
        initial={fade.initial}
        animate={fade.animate}
        transition={fade.transition}
      >
      {/* ── Opening ──────────────────────────────────────────────── */}
      {stage === "intro" &&
        (catalogueEmpty ? (
          <section className="maison-container maison-section text-center">
            <p className="maison-eyebrow">Fragrance finder</p>
            <h1 className="maison-page-title mt-5">Let us find your scent</h1>
            <p className="mt-8 text-[13px] font-light leading-[1.8] text-[#646464]">
              The catalogue is not answering just now, so the finder cannot recommend anything.
              Please try again in a few minutes, or{" "}
              <Link href="/shop" className="maison-link">
                browse the boutique
              </Link>{" "}
              in the meantime.
            </p>
          </section>
        ) : (
          <FinderIntro
            compositionCount={products.length}
            onBegin={() => setStage("question")}
          />
        ))}

      {/* ── The five questions ───────────────────────────────────── */}
      {stage === "question" && (
        <section ref={questionRef} className="maison-container maison-section">
          <div className="text-center">
            <ProgressRail index={index} total={total} />
            <p data-ask className="maison-eyebrow mt-8">
              Question {question.ordinal} of five
            </p>
            <h1 data-ask className="maison-page-title mt-5">
              {question.prompt}
            </h1>
            <p data-ask className="mt-5 text-[13px] font-light leading-[1.7] text-[#646464]">
              {question.aside}
            </p>
          </div>

          {/* The hairlines between cards are this container's background showing
              through a 1px gap. That means the container must never be visible
              on its own — fading the CARDS in from transparent exposed it as a
              grey slab on every question change. So the grid animates as one
              piece, with its cards already opaque, and the stagger lives on the
              text inside them instead. */}
          <div
            data-options
            className="mt-12 md:mt-14 mx-auto grid w-full max-w-[780px] gap-px sm:grid-cols-2"
            style={{ background: HAIRLINE }}
          >
            {question.options.map((option, i) => {
              const selected = answers[question.id] === option.value;
              return (
                <button
                  key={option.value}
                  data-option
                  type="button"
                  onClick={() => choose(option.value)}
                  aria-pressed={selected}
                  className="group relative flex flex-col items-start gap-2 bg-white px-7 py-8 text-left transition-colors duration-300 hover:bg-[#F7F7F7] cursor-pointer"
                  style={selected ? { background: "#F0F0F0" } : undefined}
                >
                  <span
                    data-option-line
                    aria-hidden="true"
                    className="absolute right-6 top-7 text-[10px] tracking-[0.18em] text-[#c4c4c4] transition-colors duration-300 group-hover:text-[#646464]"
                  >
                    {i + 1}
                  </span>
                  <span
                    data-option-line
                    className="font-display text-[16px] leading-[1.3] tracking-[0.06em] uppercase text-black pr-8"
                  >
                    {option.label}
                  </span>
                  <span
                    data-option-line
                    className="text-[13px] font-light leading-[1.7] text-[#646464]"
                  >
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <div data-foot className="mt-10 flex flex-col items-center gap-5">
            <button type="button" onClick={back} className="maison-link cursor-pointer">
              {index === 0 ? "Back to the start" : "Back"}
            </button>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#b0b0b0]">
              Press 1–{question.options.length} to choose
            </p>
          </div>
        </section>
      )}

      {/* ── Composing ────────────────────────────────────────────── */}
      {stage === "composing" && (
        <section className="maison-container maison-section text-center">
          <div className="flex min-h-[38vh] flex-col items-center justify-center">
            <p className="maison-eyebrow">One moment</p>

            <div className="mt-8 h-[26px] overflow-hidden" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.p
                  key={composingStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="font-display text-[17px] tracking-[0.07em] uppercase text-black"
                >
                  {COMPOSING_LINES[composingStep]}
                </motion.p>
              </AnimatePresence>
            </div>

            <div
              className="mt-10 h-px w-[220px] overflow-hidden"
              style={{ background: HAIRLINE }}
              aria-hidden="true"
            >
              <motion.div
                className="h-full bg-black"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: (COMPOSING_LINES.length * 420 + 320) / 1000, ease: "linear" }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Results ──────────────────────────────────────────────── */}
      {stage === "results" && (
        <section className="maison-container maison-section">
          <div className="text-center">
            <p className="maison-eyebrow">Your three</p>
            <h1 className="maison-page-title mt-5">Chosen for you</h1>
            <p className="maison-body mt-6 mx-auto max-w-[52ch]">
              Read from the note pyramid of every composition in the house against what you told
              us. Payment is collected on delivery, and two discovery samples accompany every order
              — so you can meet them properly before you commit.
            </p>
          </div>

          {/* The shopper's own reading. "Here is what we heard" is what makes a
              recommendation feel earned rather than random. */}
          <div className="mt-14 md:mt-16 mx-auto max-w-[660px]">
            <p className="maison-eyebrow text-center">Your profile</p>
            <div
              className="mt-8 px-6 py-9 sm:px-10 sm:py-10"
              style={{
                border: `1px solid ${HAIRLINE}`,
                background:
                  "linear-gradient(160deg, rgba(250,248,245,0.9) 0%, rgba(255,255,255,0) 65%)",
              }}
            >
              <ProfileBars profile={profile} delay={0.15} />
              <ProfileSummary profile={profile} />
            </div>
          </div>

          <div className="mt-8 md:mt-10">{answerChips}</div>

          {/* The three */}
          <div className="mt-16 md:mt-20 flex flex-col gap-px" style={{ background: HAIRLINE }}>
            {matches.map((match, position) => (
              <motion.article
                key={match.product.id}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: reduced ? 0 : 0.25 + position * 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white py-10 md:py-12"
              >
                <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)_240px] md:gap-10 lg:gap-12">
                  {/* The bottle. Same media treatment as the shop grid, so the
                      placeholder render today and real photography later both
                      sit correctly. */}
                  <Link
                    href={`/product/${match.product.id}`}
                    className="group block w-[190px] max-w-full mx-auto md:mx-0 md:w-full self-start"
                    aria-label={`${match.product.brand} ${match.product.name}`}
                  >
                    <span className="maison-card-media block">
                      <Image
                        src={match.product.image || "/placeholder-bottle.png"}
                        alt={`${match.product.brand} ${match.product.name}`}
                        fill
                        sizes="(min-width: 768px) 200px, 190px"
                        className="object-contain"
                      />
                    </span>
                  </Link>

                  <div>
                    <div className="flex items-baseline gap-4">
                      <span className="font-display text-[28px] leading-none tracking-[0.02em] text-black tabular-nums">
                        <CountUp to={match.match} duration={reduced ? 0 : 1100} />
                        <span className="text-[15px] align-top">%</span>
                      </span>
                      <span className="maison-eyebrow">
                        {position === 0 ? "Your closest match" : position === 1 ? "A second reading" : "Worth meeting"}
                      </span>
                    </div>

                    <h2 className="mt-5 font-display text-[19px] md:text-[21px] leading-[1.25] tracking-[0.06em] uppercase text-black">
                      <Link href={`/product/${match.product.id}`} className="hover:opacity-60 transition-opacity duration-300">
                        {match.product.name}
                      </Link>
                    </h2>

                    <p className="mt-2 text-[12px] font-light uppercase tracking-[0.06em] text-[#646464]">
                      {match.product.brand}
                      <span className="text-[#c8c8c8]"> · </span>
                      {match.styleLabel}
                    </p>

                    <p className="mt-5 max-w-[54ch] text-[14px] font-light leading-[1.8] text-black">
                      {match.reason}
                    </p>

                    <NotePyramid product={match.product} highlighted={match.highlighted} />
                  </div>

                  <div className="flex flex-col justify-start gap-4 md:pt-1">
                    <p className="maison-price">{format(match.product.price)}</p>
                    <button
                      type="button"
                      onClick={() => addToBag(match)}
                      className="maison-btn w-full cursor-pointer"
                    >
                      {added.has(match.product.id) ? "Added to your bag" : "Add to bag"}
                    </button>
                    <Link href={`/product/${match.product.id}`} className="maison-btn-outline w-full">
                      Read the composition
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          {/* ── Email capture ──────────────────────────────────────
              After the results, never in front of them. Gating the answer on an
              address is what makes people abandon a quiz — and an address given
              to keep something already shown is worth more than one extracted
              to unlock it. */}
          <div
            className="mt-16 md:mt-24 pt-12 md:pt-16 text-center"
            style={{ borderTop: `1px solid ${HAIRLINE}` }}
          >
            {capture === "sent" ? (
              <>
                <h2 className="font-display text-[18px] md:text-[20px] leading-none tracking-[0.08em] uppercase text-black">
                  On their way
                </h2>
                <p className="maison-body mt-6 mx-auto max-w-[46ch]">
                  Your three are in your inbox, with a note on why each was chosen. We will write
                  occasionally with private releases and closed sales — never often.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-[18px] md:text-[20px] leading-none tracking-[0.08em] uppercase text-black">
                  Keep your three
                </h2>
                <p className="maison-body mt-5 mx-auto max-w-[48ch]">
                  We will send them to you, with a note on why each was chosen — so you can think it
                  over away from the screen.
                </p>

                <form
                  onSubmit={sendResults}
                  className="mt-8 mx-auto flex w-full max-w-[520px] items-stretch gap-4"
                >
                  <input
                    type="email"
                    required
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email address"
                    className="h-12 min-w-0 flex-1 bg-transparent border-b border-[rgba(0,0,0,0.35)] text-[14px] font-light text-black placeholder:text-[#757575] outline-none transition-colors duration-300 focus:border-black"
                  />
                  {/* Hidden from people; only a form-filling bot ever answers. */}
                  <input
                    type="text"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="hidden"
                  />
                  <button
                    type="submit"
                    disabled={capture === "sending"}
                    className="maison-btn-outline h-12 disabled:opacity-60"
                  >
                    {capture === "sending" ? "Sending…" : "Send them"}
                  </button>
                </form>

                {captureError && (
                  <p role="alert" className="mt-4 text-[13px] font-light text-black">
                    {captureError}
                  </p>
                )}
              </>
            )}

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button type="button" onClick={restart} className="maison-link cursor-pointer">
                Start again
              </button>
              <span aria-hidden="true" className="hidden sm:block h-px w-6" style={{ background: HAIRLINE }} />
              <Link href="/shop" className="maison-link">
                See the whole catalogue
              </Link>
            </div>
          </div>
        </section>
      )}
      </motion.div>
    </div>
  );
}
