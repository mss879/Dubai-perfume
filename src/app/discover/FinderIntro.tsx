"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * The opening of the fragrance finder.
 *
 * This screen has one job: get somebody to press Begin. Everything that does
 * not serve that is gone — the long explanatory paragraph (the questions
 * explain themselves), and the "I would rather browse" escape hatch, which
 * offered an exit to someone who had already chosen to be here.
 *
 * What replaces it is atmosphere. The notes drifting behind the type are real
 * materials out of the catalogue, moving slowly at the edge of legibility, so
 * the page reads as a perfumery rather than a form.
 *
 * ── Animation, and not depending on it ───────────────────────────────────────
 *
 * GSAP drives this, and GSAP is driven by requestAnimationFrame, which does not
 * run in a hidden tab. A `gsap.from()` sets its start state immediately and only
 * reaches the end state when frames arrive — so on a page opened in a background
 * tab the headline would be stuck at opacity 0, invisible, possibly forever.
 *
 * So the markup renders in its FINAL state, and the animation is applied only
 * once we know it can actually run. If it never runs, the screen is simply
 * static and completely usable. Motion is decoration here, never the thing that
 * makes content appear.
 */

/**
 * How faint a drifting note rests at.
 *
 * Scaled DOWN with size: a 34px word covers several times the area of an 18px
 * one, so at equal opacity it carries far more weight and starts competing with
 * the headline. Big words therefore sit fainter than small ones, which is what
 * keeps the cloud reading as atmosphere rather than as text.
 */
const restingOpacity = (size: number) =>
  Math.max(0.085, Math.min(0.16, 0.16 - (size - 18) * 0.004));

/**
 * One drifting word, as a physical body.
 *
 * The cloud is a small particle simulation rather than a set of looping tweens:
 * the words travel in straight lines, bounce off the edges of the section, and
 * bounce off EACH OTHER. Looping tweens can only ever retrace the same path, so
 * they read as decoration on a timer; bodies that collide read as something
 * actually moving through the air, which is the point.
 */
type Body = {
  el: HTMLElement;
  /** Where the element sits from CSS alone, so the transform is a delta on top. */
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** Frames to wait before this body may flare again. */
  cooldown: number;
  setX: (value: number) => void;
  setY: (value: number) => void;
};

/**
 * A stable pseudo-random in [0,1) from an integer.
 *
 * Deterministic on purpose: the same word always sets off in the same
 * direction, so the opening looks identical on every visit and a layout bug is
 * reproducible rather than a one-in-fifty accident.
 */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* Real materials from the catalogue. Positions are fixed rather than random so
   the server and client agree, and kept clear of the centre column where the
   type sits. */
const DRIFTING_NOTES: { note: string; top: string; left: string; size: number }[] = [
  { note: "Oud", top: "14%", left: "8%", size: 34 },
  { note: "Saffron", top: "30%", left: "3%", size: 22 },
  { note: "Bergamot", top: "62%", left: "7%", size: 27 },
  { note: "Sandalwood", top: "80%", left: "14%", size: 20 },
  { note: "Amber", top: "22%", left: "19%", size: 19 },
  { note: "Patchouli", top: "72%", left: "24%", size: 18 },
  { note: "Rose", top: "12%", left: "78%", size: 30 },
  { note: "Vanilla", top: "34%", left: "88%", size: 24 },
  { note: "Incense", top: "58%", left: "83%", size: 21 },
  { note: "Cardamom", top: "78%", left: "74%", size: 19 },
  { note: "Musk", top: "20%", left: "68%", size: 18 },
  { note: "Leather", top: "86%", left: "58%", size: 22 },
  { note: "Jasmine", top: "8%", left: "44%", size: 20 },
  { note: "Tonka Bean", top: "90%", left: "38%", size: 18 },
];

const HEADLINE_LINES = [
  ["Let", "us", "find"],
  ["your", "scent"],
];

export default function FinderIntro({
  compositionCount,
  onBegin,
}: {
  compositionCount: number;
  onBegin: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  /** The box the simulation runs inside — the words bounce off its edges. */
  const cloudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A hidden tab gets no frames. Animating into view from opacity 0 there
    // would hide the page rather than reveal it.
    if (reduced || document.hidden) return;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline
        .from("[data-eyebrow]", { opacity: 0, y: 10, duration: 0.6 })
        // The headline rises out of its own clipped line — the words appear to
        // be set rather than to fade in.
        .from(
          "[data-word]",
          { yPercent: 115, duration: 0.9, stagger: 0.07, ease: "power4.out" },
          "-=0.35"
        )
        .from("[data-sub]", { opacity: 0, y: 12, duration: 0.6 }, "-=0.5")
        // A hairline drawing down into the button, which arrives after it.
        .from("[data-rule]", { scaleY: 0, duration: 0.7, ease: "power2.inOut" }, "-=0.4")
        .from("[data-cta]", { opacity: 0, y: 14, duration: 0.6 }, "-=0.3")
        .from("[data-stat]", { opacity: 0, duration: 0.7 }, "-=0.4");

      // The cloud fades up to its RESTING opacity — never to 1. Animating these
      // to full opacity is what turned a background wash into black text
      // shouting over the headline.
      gsap.utils.toArray<HTMLElement>("[data-note]").forEach((node, i) => {
        const rest = Number(node.dataset.rest ?? 0.12);
        gsap.fromTo(
          node,
          { opacity: 0 },
          { opacity: rest, duration: 1.8, delay: 0.3 + i * 0.07, ease: "power2.out" }
        );
      });
    }, element);

    /* ── The cloud, simulated ──────────────────────────────────────────────
     *
     * Bodies travel, bounce off the walls, and bounce off one another.
     *
     * Collisions are resolved as axis-aligned boxes rather than circles: these
     * are words, three or four times wider than they are tall, and a circle big
     * enough to contain one would have them rebounding off empty space well
     * before the letters ever met.
     */
    const cloud = cloudRef.current;
    let bodies: Body[] = [];
    let bounds = { width: 0, height: 0 };

    const measure = () => {
      if (!cloud) return;
      const box = cloud.getBoundingClientRect();
      bounds = { width: box.width, height: box.height };

      bodies = gsap.utils.toArray<HTMLElement>("[data-note]", cloud).map((el, i) => {
        // Read the position CSS already gave it, then drive a delta from there.
        // That way the un-simulated markup is still laid out sensibly.
        const rect = el.getBoundingClientRect();
        const baseX = rect.left - box.left;
        const baseY = rect.top - box.top;
        const angle = seeded(i + 1) * Math.PI * 2;
        const speed = 11 + seeded(i + 41) * 15; // px per second — a slow drift
        return {
          el,
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          w: rect.width,
          h: rect.height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          cooldown: 0,
          setX: gsap.quickSetter(el, "x", "px") as (v: number) => void,
          setY: gsap.quickSetter(el, "y", "px") as (v: number) => void,
        };
      });
    };

    measure();

    /** A brief swell where two words meet, so a collision reads as an event. */
    const flare = (body: Body) => {
      if (body.cooldown > 0) return;
      body.cooldown = 40;
      gsap.fromTo(
        body.el,
        { scale: 1 },
        { scale: 1.07, duration: 0.22, yoyo: true, repeat: 1, ease: "power2.out" }
      );
    };

    const step = (_time: number, deltaMs: number) => {
      if (bodies.length === 0 || bounds.width === 0) return;
      // Clamped: a tab that was backgrounded returns with a huge delta, and
      // integrating it in one step would fling every word off the page.
      const dt = Math.min(deltaMs, 50) / 1000;

      for (const b of bodies) {
        if (b.cooldown > 0) b.cooldown -= 1;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Walls.
        if (b.x < 0) {
          b.x = 0;
          b.vx = Math.abs(b.vx);
        } else if (b.x + b.w > bounds.width) {
          b.x = bounds.width - b.w;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < 0) {
          b.y = 0;
          b.vy = Math.abs(b.vy);
        } else if (b.y + b.h > bounds.height) {
          b.y = bounds.height - b.h;
          b.vy = -Math.abs(b.vy);
        }
      }

      // Each other. Fourteen bodies is ninety-one pairs — cheap enough to check
      // every one every frame without an index.
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i];
          const b = bodies[j];

          const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          if (overlapX <= 0) continue;
          const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (overlapY <= 0) continue;

          // Separate along whichever axis they are least deep on — that is the
          // one they most recently crossed.
          if (overlapX < overlapY) {
            const push = overlapX / 2;
            if (a.x < b.x) {
              a.x -= push;
              b.x += push;
            } else {
              a.x += push;
              b.x -= push;
            }
            const swap = a.vx;
            a.vx = b.vx;
            b.vx = swap;
          } else {
            const push = overlapY / 2;
            if (a.y < b.y) {
              a.y -= push;
              b.y += push;
            } else {
              a.y += push;
              b.y -= push;
            }
            const swap = a.vy;
            a.vy = b.vy;
            b.vy = swap;
          }

          flare(a);
          flare(b);
        }
      }

      for (const b of bodies) {
        b.setX(b.x - b.baseX);
        b.setY(b.y - b.baseY);
      }
    };

    gsap.ticker.add(step);

    // Re-measure on resize, and re-seat every body inside the new box.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        gsap.set("[data-note]", { x: 0, y: 0 });
        measure();
      }, 200);
    };
    window.addEventListener("resize", onResize);

    // Parallax. Pointer-driven, so it costs nothing until the pointer moves,
    // and it is skipped entirely on touch where there is no pointer to follow.
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      gsap.to("[data-cloud]", { x: x * -18, y: y * -12, duration: 1.2, ease: "power2.out" });
    };
    if (fine) window.addEventListener("pointermove", onMove);

    return () => {
      if (fine) window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      gsap.ticker.remove(step);
      context.revert();
    };
  }, []);

  return (
    <div ref={root} className="relative overflow-hidden">
      {/* ── The drifting materials ─────────────────────────────────── */}
      <div
        ref={cloudRef}
        data-cloud
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        {DRIFTING_NOTES.map((n) => (
          <span
            key={n.note}
            data-note
            data-rest={restingOpacity(n.size)}
            className="absolute font-display uppercase tracking-[0.18em] text-black"
            style={{
              top: n.top,
              left: n.left,
              fontSize: `${n.size}px`,
              // Rendered at its resting opacity, so a page that never gets a
              // frame still looks composed. The tween only re-times the reveal.
              opacity: restingOpacity(n.size),
            }}
          >
            {n.note}
          </span>
        ))}
      </div>

      {/* ── The type ───────────────────────────────────────────────── */}
      <section className="maison-container relative flex min-h-[76vh] flex-col items-center justify-center py-20 text-center">
        <p data-eyebrow className="maison-eyebrow">
          Fragrance finder
        </p>

        <h1 className="mt-7 font-display uppercase leading-[1.04] tracking-[0.06em] text-black">
          {HEADLINE_LINES.map((line, i) => (
            <span key={i} className="block overflow-hidden py-[0.06em]">
              {line.map((word) => (
                <span
                  key={word}
                  data-word
                  className="inline-block text-[34px] sm:text-[46px] md:text-[58px] lg:text-[66px]"
                >
                  {word}
                  <span className="inline-block w-[0.26em]" />
                </span>
              ))}
            </span>
          ))}
        </h1>

        <p
          data-sub
          className="mt-8 text-[14px] font-light tracking-[0.02em] text-[#646464] md:text-[15px]"
        >
          Five questions. Three fragrances. About a minute.
        </p>

        <span
          data-rule
          aria-hidden="true"
          className="mt-10 block h-12 w-px origin-top bg-[rgba(0,0,0,0.18)]"
        />

        <button
          data-cta
          type="button"
          onClick={onBegin}
          className="maison-btn mt-10 min-w-[220px] cursor-pointer"
        >
          Begin
        </button>

        <p
          data-stat
          className="mt-12 text-[11px] uppercase tracking-[0.18em] text-[#9a9a9a]"
        >
          {compositionCount} compositions read for you
        </p>
      </section>
    </div>
  );
}
