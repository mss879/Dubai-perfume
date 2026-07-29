# Gharib Storefront Design System

Derived from a live audit of **ae.parfums-de-marly.com** (computed styles, DOM structure,
screenshots). This is the single source of truth for the storefront redesign.

The goal: a quiet, editorial, luxury-maison feel. **Not** a tech/startup feel.

---

## 1. Non-negotiable rules

These are what separate "classy perfume house" from "tech company". Follow them literally.

| Rule | Why |
| --- | --- |
| `border-radius: 0` on **everything** — buttons, inputs, cards, images, badges, panels | Rounded corners read as SaaS |
| **No box shadows.** No `shadow-*`, no glows, no `drop-shadow` | Luxury retail uses hairlines, not elevation |
| **No gradients**, no `blur-[120px]` ambience blobs, no glassmorphism / `backdrop-blur` | Flat, printed-catalogue feel |
| **No amber / gold / brown accent colour.** Palette is black, white, two greys | The brand accent is *typography*, not colour |
| Product cards have **no background, no border, no padding box** — the product image floats on the page | Editorial catalogue |
| Never use `font-black` / `font-extrabold` / `tracking-tighter` | Heavy tight sans = tech. Use light serif + wide letter-spacing |
| Generous whitespace. Section padding ≥ 80px desktop | Luxury = air |
| Motion is slow and minimal: image scale on hover, fades. No springs, no bounces, no float loops | Restraint |

---

## 2. Type system

Two families only.

```
Display  → 'Source Serif 4', Georgia, serif   → class: font-display
Body/UI  → 'Inter', system-ui, sans-serif     → class: font-body
```

Both are loaded in `globals.css`. `body` defaults to Inter.

> The reference site uses Libre Baskerville. The owner asked for something "not too fancy",
> so the display face is **Source Serif 4** — a low-contrast, flat-stroked serif. Same
> sizes, same letter-spacing, same uppercase treatment; it just reads plainer. Do not
> swap it back.

### Display scale (Source Serif 4, weight 400, colour `#000`)

| Use | Size | Letter-spacing | Line-height | Transform |
| --- | --- | --- | --- | --- |
| Section title (homepage) | `38px` (mobile `26px`) | `normal` | `1.0` | uppercase |
| Page / collection title | `28px` | `0.1em` | `1.0` | uppercase |
| PDP product title | `36px` (mobile `28px`) | `0.1em` | `1.1` | uppercase |
| Product-card title | `18px` | `0.08em` | `1.3` | uppercase |
| Drawer / modal title | `20px` | `0.07em` | `1.0` | uppercase |
| Editorial pull-quote | `24px` | `0.02em` | `1.5` | none, italic |

### Body scale (Inter)

| Use | Size | Weight | Letter-spacing | Transform |
| --- | --- | --- | --- | --- |
| Body copy | `14px` | 300 | normal | none |
| Nav link | `15px` | 350 | `0.06em` | uppercase |
| Footer link | `14px` | 350 | normal | none |
| Footer column heading | `16px` | 400 | `0.04em` | none (sentence case) |
| Eyebrow / badge / meta | `12px` | 400 | `0.1em` | uppercase |
| Scent-note row on card | `12px` | 400 | normal | uppercase, colour `#646464` |
| Price | `14px` | 350 | `0.07em` | none |
| PDP price (large) | `20px` | 500 | normal | none |
| Button label | `12–14px` | 500 | `0.2em` | uppercase |
| Text-link CTA | `12px` | 600 | `0.2em` | uppercase + 1px underline |

---

## 3. Colour

```css
--ink:        #000000;   /* primary text */
--ink-soft:   #121212;   /* button fill / borders */
--muted:      #646464;   /* scent notes, meta */
--muted-2:    #757575;   /* secondary body */
--line:       rgba(0,0,0,0.12);  /* hairlines */
--surface:    #FFFFFF;   /* page */
--surface-2:  #F5F5F5;   /* PDP media stage, info panels */
--surface-3:  #F8F8F8;   /* alternating sections */
```

Announcement bar is the one inverted surface: `#000` background, `#fff` text.

---

## 4. Layout

- Container: `max-width: 1400px`, horizontal padding `60px` desktop / `20px` mobile.
- Product grid: 4 columns desktop, 3 tablet, 2 mobile. Gap `32px`.
- Section rhythm: `padding: 80px 0` desktop, `56px 0` mobile.
- Section separators are hairlines (`1px solid var(--line)`), never shadows or coloured bands.

---

## 5. Components

### 5.1 Header (3 rows, sticky, white)

```
Row 1  ▸ black bar, 39px, centered 12px/400 uppercase ls .1em white text, ‹ › arrows
Row 2  ▸ white, ~62px: [locale ▾] [⌕ SEARCH]  ······ CENTERED WORDMARK ······  [SIGN IN] [icons]
Row 3  ▸ white, ~48px: main nav, centered, evenly spaced, 15px/350 uppercase ls .06em
         1px bottom hairline
```
Right icons: pin, account, bookmark (wishlist), bag. Line icons, 1.25px stroke, black.
Nav hover: underline offset 6px. No colour change.

### 5.2 Product card — the signature component

```
┌─────────────────────┐
│ [ICONIC]            │  ← optional label, 12px/400 uppercase ls .1em, top-left,
│                     │     black text on transparent (or black pill w/ white text on PDP)
│                     │
│      (image)        │  ← 1 : 1, object-contain, NO background, NO border
│                     │     hover: scale(1.04) over 700ms
└─────────────────────┘
        VALAYA            ← font-display 18px ls .08em uppercase, CENTERED
   FLORAL WOODY MUSKY     ← 12px uppercase #646464, centered, notes space-separated
   AED 1,490      75ml ▾  ← size/price select row, 14px/350, 1px bottom hairline
┌─────────────────────┐
│    ADD TO CART      │  ← outlined: white bg, 1px solid #121212, black text,
└─────────────────────┘     12px/500 ls .2em uppercase, height 48px, full width
```

Card itself: `background: transparent`, no border, no radius, no shadow, no padding.

### 5.3 Buttons

```css
/* Primary — used for ADD TO CART on PDP, checkout */
background:#121212; color:#fff; border:1px solid #121212;
padding:14px 32px; font:500 12px/1 Inter; letter-spacing:.2em; text-transform:uppercase;
hover → background:#fff; color:#121212;

/* Secondary / outline — used on cards */
background:#fff; color:#121212; border:1px solid #121212;
hover → background:#121212; color:#fff;

/* Text link CTA */
font:600 12px Inter; letter-spacing:.2em; uppercase;
border-bottom:1px solid currentColor; padding-bottom:4px;
```
All transitions `300ms ease`.

### 5.4 PDP

Desktop split **65 / 35**, info column `padding-left: 40px`.

**Left — media stage** on `#F5F5F5`:
- 1 full-width hero image, then a 2-column grid of square images.
- Black `ICONIC` / `NEW` pill top-left of the first tile (white 12px uppercase ls .1em).

**Right — info column** (in order):
1. Title — `font-display` 36px ls .1em uppercase
2. Size swatches — 100×37 boxes, `1px solid #000`, 12px/400 ls .08em, centered.
   Selected: 2px border + ✓ glyph. Radius 0.
3. Price — Inter 20px/500, right-aligned on the swatch row
4. `Delivery from …` — 13px/300 `#646464`
5. **ADD TO CART** — primary button, full width, 48px tall
6. Offer panel — `#F5F5F5`, 20px padding: eyebrow uppercase ls .12em + 14px/300 body
7. Reassurance grid — 2×2, small line icon + 13px label with hairline underline
8. Short description — 15px/300, line-height 1.6
9. Accordions (`<details>`): `Description`, `Olfactive pyramid`, `Ingredients`,
   `You may also like`, `Precautions for use`. Hairline top border, summary padding `15px 0`,
   16px/300, `+ / −` glyph on the right.

Below the fold: pull-quote section → editorial story → related-fragrance comparison cards.

### 5.5 Collection / shop page

```
sub-nav tabs (15px/350, active = 1px underline, centered)
COLLECTION:            ← 12px uppercase ls .1em #646464, centered
ALL FRAGRANCES         ← font-display 28px ls .1em uppercase, centered
─────────────────────────────────────────────────────
All filters        62 products              Featured ▾
─────────────────────────────────────────────────────
4-column product grid, 32px gap
```
Filter bar: hairline top and bottom, 56px tall. `All filters` underlined, left.
Count centered 14px/350. Sort = bare select with bottom hairline, right.

### 5.6 Cart drawer

Right-side panel, white, 440px. Header: `YOUR SELECTION` `font-display` 20px uppercase ls .07em
+ item count, `×` close. Line items: 96px square thumb on `#F5F5F5` + serif name + notes + qty
stepper (bare, hairline box) + price. Footer: subtotal row, then full-width primary
`PROCEED TO CHECKOUT`. A `RECOMMENDED FOR YOU` rail sits alongside on desktop.

### 5.7 Editorial / content sections

Four repeatable blocks — use these instead of bento grids:

1. **Full-bleed banner** — image, centered `font-display` uppercase title over it, text-link CTA
   underneath. Text is black on light imagery, white on dark. No overlay scrim unless needed.
2. **Split 50/50** — image one side, text the other (alternate direction per section):
   `font-display` 28px uppercase title, 15px/300 body (max 46ch), text-link CTA.
3. **Category tiles** — 4 across: image + `font-display` 18px uppercase caption + `DISCOVER`
   text-link, centered.
4. **Pull-quote** — centered italic serif 24px, attribution 12px uppercase ls .1em `#646464`.

### 5.8 Footer

White, hairline top. 4 link columns + brand column.
Column headings: Inter 16px/400 ls .04em, **sentence case** ("Fragrances", not "FRAGRANCES").
Links: 14px/350 `rgba(0,0,0,.75)`, hover → `#000`.
Newsletter: bare input with hairline underline + `JOIN IN` outline button.
Bottom bar: 12px/300 `#757575`, payment marks, legal links.

---

## 6. Forms

Inputs: no radius, `1px solid rgba(0,0,0,.35)`, height 48px, padding `0 14px`, 14px/300.
Focus → border `#000`, no ring, no glow.
Labels: 12px uppercase ls .1em `#646464`, above the field.
Checkbox/radio: 16px square, 1px black border, radius 0.

---

## 7. Motion

| Element | Behaviour |
| --- | --- |
| Product image hover | `scale(1.04)`, 700ms ease-out |
| Buttons / links | colour + background, 300ms ease |
| Section entry | fade + 12px rise, 600ms, once, `ease-out` — optional, use sparingly |
| Drawers | slide 300ms `cubic-bezier(.16,1,.3,1)` |

Banned: infinite float loops, pulsing glows, heartbeat icons, sparkles, springy scale.

---

## 8. Out of scope (do not touch)

- `PreloaderMistReveal` and the preloader block in `src/app/page.tsx`
- The homepage hero fold (`{/* 1. Hero Full Screen Fold */}` through the end of that
  `<section>`), including its inline dark header and the `BEST SELLER` marquee strip
- `src/app/admin/**` (internal tooling)
- `.font-serif-luxury` / `.font-sans-luxury` utilities — the hero and preloader depend on them
