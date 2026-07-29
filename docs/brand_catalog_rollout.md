# Brand catalogue rollout (migrations 24–31)

This adds the six new houses to the store, gives every house its own collection page, and
wires the brand pages into the navigation.

## What ships

| Migration | Contents |
| --- | --- |
| `24_brand_and_line_collections.sql` | Adds `kind`, `parent_id`, `sort_order`, `brand` to `collections`; creates the 7 brand collections and 27 line collections; indexes; pushes the `products` id sequence past the seeded range |
| `25_seed_rasasi_catalog.sql` | 37 Rasasi products (29 Hawas + Blue + La Yuqawam + 5 Dareej) |
| `26_seed_lattafa_catalog.sql` | 51 Lattafa products |
| `27_seed_armaf_catalog.sql` | 23 Armaf products (Club de Nuit, Precioux, Odyssey) |
| `28_seed_french_avenue_catalog.sql` | 12 French Avenue products |
| `29_seed_afnan_catalog.sql` | 9 Afnan products (9PM, Supremacy, 9AM Dive) |
| `30_seed_al_haramain_catalog.sql` | 4 Al Haramain Amber Oud editions |
| `31_brand_editorial_content.sql` | Researched house story, verified stat chips, pull quote, per-brand palette and hero/texture art for every brand page; researched olfactory descriptions for the line collections |

**136 new products**, each with an inventory row per size (stock 25, low-stock threshold 5)
and a mapping into its brand collection plus its sub-line collection.

## How to apply

Open the Supabase dashboard → **SQL Editor**, then paste and run the files **in order,
24 through 31**. Each file is idempotent:

* product inserts use `ON CONFLICT (id) DO NOTHING`
* inventory and collection mappings use `ON CONFLICT DO NOTHING`
* collection rows refresh their title/description only

So re-running a file never overwrites an image you uploaded, a price you edited, or stock
you adjusted.

## Seeded values you will want to change

| Field | Seeded as | Where to edit |
| --- | --- | --- |
| Price | `AED 199.00` for every new product | Admin → Products → edit |
| Images | `/placeholder-bottle.png` | Admin → Products → edit → upload (goes to the `product-images` bucket) |
| Description / tagline | Generated one-liner per product | Admin → Products → edit |
| Olfactory family | Assigned per product from the name | Admin → Products → edit |
| Stock | 25 per size | Admin → Inventory |
| Sizes | `100ml` (Club de Nuit Intense Man: `150ml`, `200ml`) | Admin → Products → edit |
| New / Bestseller flags | Off — so the homepage sections stay curated | Admin → Products → edit |

Product ids are reserved by brand so the seeds stay stable: Rasasi 1000–1037,
Lattafa 1100–1150, Armaf 1200–1222, French Avenue 1300–1311, Afnan 1400–1408,
Al Haramain 1500–1503. The admin panel assigns a new product `max(id) + 1`, so products you
add next take 1504 onwards; migration 24 also pushes the `products` id sequence past 2000 so
any insert that relies on the SERIAL default can never land on a seeded id.

## Spellings normalised from the source list

`Eclait` → **Eclat**, `Saphire` → **Sapphire**, `Elixer` → **Elixir**,
`Kharam qahwa` → **Khamrah Qahwa**, `dhukan` → **Dukhan**, `Fucker, lotta men` →
**Fakhar Lattafa Men** (and the Women / Gold / Rose Gold flankers), `Ana abiad` →
**Ana Abiyedh**, `Exlair banofi` → **Eclaire Banoffee**, `Ejazi` → **Ejaazi**,
`Layuqham` → **La Yuqawam**, `Dareeq men` → **Dareej Men**, `Vulcan fie` → **Vulcan Feu**,
`Vulcan beie` → **Vulcan Beige**, `Aeither extrait` → **Aether Extrait**,
`Supremacy not only intense` → **Supremacy Not Only Intense**. Al Haramain items were
prefixed with their line: **Amber Oud** Gold Edition / Aqua Dubai / Dubai Night / Ruby
Edition. `Hawas La'meir` and `Shmellow` were kept exactly as written.

Two entries in the source list were lines rather than products — French Avenue
**Aromatix** and **Veneno** ("all perfumes"). Each is seeded as a single product; send the
individual variant names and they can be expanded into their own line collections.

`Club de nuit untold` appeared twice and was seeded once.

## Storefront

* `/collections` — every house, with fragrance and line counts
* `/collection/<id>` — one page per brand (`rasasi`, `lattafa`, `armaf`, `french-avenue`,
  `afnan`, `al-haramain`, `gharib`), with line filters (Hawas, Club de Nuit, Yara, …),
  olfactory filters, sorting, size selection and add-to-bag
* `/collection/<line-id>` also works directly, e.g. `/collection/hawas`
* `BRANDS` in the desktop navbars, the Shop mega-menu and the mobile menu link to these pages

A brand page lists anything mapped into the collection **or** any product whose `brand`
matches, so a product added later from the admin panel appears without extra wiring.

## The brand page (migration 31)

Each house page is built from researched content, not boilerplate:

1. **Cinematic hero** — generated brand-mood image, parallax on scroll, brand name in a
   masked word reveal, the house's editorial line, and four **verified** stat chips that
   count up (e.g. Rasasi: founded 1979 · Dubai · 37 fragrances · Hawas debut 2015).
2. **The House** — two researched paragraphs revealed line by line, plus a pull quote that
   wipes in.
3. **The Lines** — circular medallions, each carrying the house texture and its fragrance
   count. On desktop the section pins and the rail scrolls horizontally as you scroll down
   (16 medallions for Lattafa). Clicking one filters the grid below; under 1024px it becomes
   an ordinary swipeable rail.
4. **Filter bar** — line chips, olfactory chips with counts, and sorting; sticky under the nav.
5. **Product grid** — numbered section header, pill filters, and rounded dark cards with a
   warm radial glow. Products with no photography yet show a hairline diamond and their size
   in the house colour rather than a repeated placeholder bottle.
6. **Texture band** — parallax material study with the house's pull quote.

Design notes: the pages sit on a dark espresso ground (#150F0B) with warm radial glows,
cream Playfair Display display type, pill controls, rounded cards and a house-letter
watermark behind the hero. Each house has its own light-on-dark accent (see the header of
migration 31) so the six pages read as one system without looking identical.

Motion notes: GSAP + ScrollTrigger, scoped with `gsap.context` and cleaned up on unmount.
`prefers-reduced-motion: reduce` gets the full page with no animation. Lag smoothing is
disabled and the hero timeline has a 5.2s failsafe, so a page that loads in a background tab
can never be left with invisible copy.

### Copy accuracy

Every hard fact on these pages was researched, then independently re-verified by a second
pass that was told to refute it. Some findings corrected the common wisdom:

* **Lattafa** is headquartered in **Sharjah** (Emirates Industrial City, Al Sajaa), not
  Dubai as most press repeats. No verifiable founding year exists — the house's own US site
  says "the 1980s", so the page says the 1980s.
* **Armaf** — Fragrantica's 1999 is unsupported; the parent, Sterling Perfumes, dates to
  1998, and a 2023 Messe Frankfurt release states Sterling had no proprietary brands as of
  2003. The page credits 1998 to the house, not the Armaf name.
* **Rasasi** — founded 1979 by Haji Abdul Razzak Kalsekar in Murshid Bazar, Deira;
  in-house oud distillation in Jebel Ali from 1986; Hawas launched 2015.
* **Al Haramain** — Makkah 1970, Dubai from 1981.

Where a fact could not be corroborated it was dropped or hedged rather than printed.

### Imagery

`public/brands/*-hero.jpg` and `*-texture.jpg` are **generated art direction** (Higgsfield,
Cinema Studio 2.5), art-directed per house from its real palette and materials — agarwood
and gold leaf on linen for Rasasi, graphite and brass for Armaf, dates and saffron for
Lattafa. They deliberately contain no logos, no lettering, no real bottle designs and no
people, so nothing here imitates another company's brand photography. 12 images, ~3.5 MB
total, resized and re-encoded as progressive JPEG (heroes 2400px, textures 1200px).

To swap in your own photography later, replace the file at the same path or update
`collections.hero_image` / `texture_image`.

**Ratios.** Heroes are 16:9 (2400x1340). Desktop hero containers sit at roughly 1.8:1, so
the art is shown almost uncropped. Phones do **not** stretch that image over a tall
viewport — the hero stacks instead: a correctly proportioned 16:10 image band with the copy
below it. Textures are 1:1 (1200px) and abstract, so the closing band crops them harmlessly.

**Before migration 31 is applied**, `HOUSE_ART` in the collection page supplies the same six
palettes and image paths from code, so the pages already look right. The database always
takes precedence once the migration lands.
