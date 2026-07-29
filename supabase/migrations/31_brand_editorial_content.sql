-- Migration 31: Editorial content and art direction for the brand collection pages
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Copy was researched from each house's own materials and fragrance databases, independently
-- fact-checked by a second pass told to refute it, then edited across all six houses for
-- consistency. Anything that could not be corroborated was dropped or hedged rather than
-- printed. Hero/texture imagery is generated art direction (public/brands/*), not brand
-- photography.
--
-- The house pages run on a dark espresso ground, so accents are the light-on-dark tones;
-- each clears 8:1 against the base:
--   rasasi         #E3B573  warm gold on espresso, 9.6:1
--   lattafa        #E8C07F  brass gold, 10.4:1
--   armaf          #CFC6B0  warm pewter, 9.9:1
--   french-avenue  #E9A075  rust copper, 8.2:1
--   afnan          #CDC58D  olive bronze, 9.8:1
--   al-haramain    #DDA96F  agarwood gold, 8.6:1

ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS story_eyebrow TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS story_headline TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS story_subline TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS story_body TEXT[];
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS pull_quote TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS accent_hex VARCHAR(9);
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS deep_hex VARCHAR(9);
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS mist_hex VARCHAR(9);
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS hero_image TEXT;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS texture_image TEXT;

-- ── rasasi ──────────────────────────────────────────────────────────────────
-- founded 1979 — corroborated by the brand's own about/story pages (rasasi.com, rasasistore.com, om.rasasistore.com, ras
-- home    Dubai, United Arab Emirates. Two addresses are both legitimately sourced and non-exclusive: the corporate/regi
UPDATE public.collections SET
    story_eyebrow  = 'Dubai, since 1979',
    story_headline = 'The Gulf on its own terms',
    story_subline  = 'One shop in a Deira souk, two ranges kept deliberately apart, and a Dubai house that built its own distillery.',
    story_body     = ARRAY['In 1979 Haji Abdul Razzak Kalsekar opened a single perfume shop in Murshid Bazar, the old souk quarter of Deira. While others imported European scent, he built on the Gulf''s own materials — concentrated oils, agarwood, bukhoor. From 1986 the house distilled its own oud at a plant in Jebel Ali Free Zone. It remains family-owned.', 'Two ranges have always run in parallel: an Oriental side of attar, oud and bukhoor, and an Occidental side of Western-style sprays. Blue Lady, which Rasasi calls its maiden Western label, carried the house abroad. Hawas followed in 2015 — bergamot, apple and cinnamon over plum and cardamom, closing on driftwood and grey amber — and now fills twenty-nine bottles in this catalogue.']::TEXT[],
    pull_quote     = 'A souk shop in Deira that never pretended to be French.',
    stats          = '[{"label": "Founded", "value": "1979"}, {"label": "Home", "value": "Dubai, UAE"}, {"label": "Fragrances here", "value": "37"}, {"label": "Hawas debut", "value": "2015"}]'::jsonb,
    accent_hex     = '#E3B573',
    deep_hex       = '#0C2233',
    mist_hex       = '#F0E9DC',
    hero_image     = '/brands/rasasi-hero.jpg',
    texture_image  = '/brands/rasasi-texture.jpg',
    cover_image    = '/brands/rasasi-hero.jpg',
    description    = 'One shop in a Deira souk, two ranges kept deliberately apart, and a Dubai house that built its own distillery.'
WHERE id = 'rasasi';

-- ── lattafa ─────────────────────────────────────────────────────────────────
-- founded 1980s (hedged, not a single year). Lattafa's official US site states "Lattafa was founded in the 1980s by Shei
-- home    Emirates Industrial City, Al Sajaa Industrial, Sharjah, UAE — published on lattafa.com/contact-us (landline 06
UPDATE public.collections SET
    story_eyebrow  = 'Sharjah, since the 1980s',
    story_headline = 'A gentler name for opulence',
    story_subline  = 'Named for Latif and Lateefa — gentleness, pleasantness — and built on Arabian spice carried in glass heavy enough to feel earned.',
    story_body     = ARRAY['The house was founded in the 1980s by Sheikh Shahid Ahmad, who came to Dubai from Pakistan and spent thirteen years behind the counter of his uncle''s perfume shop before starting his own. It still runs from Sharjah''s Al Sajaa industrial belt — family-held into a third generation, manufacturing under its own roof rather than farming the work out.', 'The house''s arithmetic is its own: heavy dosage, sweet Arabian structure, and no restraint at the top. Khamrah, 2022, layers bergamot and cinnamon over a dates accord, praline and roasted tonka. Asad, a year earlier, set pineapple and tobacco over coffee and iris. Maahir is capped with a horse''s head, and the house marks its packaging with a 3D hologram against counterfeits.']::TEXT[],
    pull_quote     = 'Gentleness is in the name. Nothing else about it is quiet.',
    stats          = '[{"label": "Founded", "value": "1980s"}, {"label": "Home", "value": "Sharjah, UAE"}, {"label": "Lines carried", "value": "16"}, {"label": "Fragrances here", "value": "51"}]'::jsonb,
    accent_hex     = '#E8C07F',
    deep_hex       = '#0A0A0C',
    mist_hex       = '#F4EDE0',
    hero_image     = '/brands/lattafa-hero.jpg',
    texture_image  = '/brands/lattafa-texture.jpg',
    cover_image    = '/brands/lattafa-hero.jpg',
    description    = 'Named for Latif and Lateefa — gentleness, pleasantness — and built on Arabian spice carried in glass heavy enough to feel earned.'
WHERE id = 'lattafa';

-- ── armaf ───────────────────────────────────────────────────────────────────
-- founded 1998 — for the manufacturer, Sterling Perfumes Industries LLC (trading as Sterling Parfums). Independently cor
-- home    Dubai, United Arab Emirates. Corporate address P.O. Box 40769, Dubai, confirmed on both sterlingparfums.com an
UPDATE public.collections SET
    story_eyebrow  = 'Made in Dubai',
    story_headline = 'The factory that became a house',
    story_subline  = 'Sterling Parfums has made fragrance in Dubai since 1998; Armaf is the name it puts on its own glass.',
    story_body     = ARRAY['Armaf is the flagship fragrance name of Sterling Parfums, the Dubai manufacturer Dr Ali Asgar Fakhruddin established in 1998 within his family''s Fakhruddin Holdings group. Sterling''s premise is scale: roughly 500,000 square feet of production at Dubai Investment Park, GMP and ISO 9001 accreditation, and an annual capacity of some 125 million pieces across beauty and personal care.', 'Owning the plant means Armaf sets its own tempo: Club de Nuit began in 2015 and became a family — Sillage in 2020, Untold in 2022, the Precieux extrait tier in 2024, Maleka with perfumer Olivier Cresp in 2025. Odyssey moves faster still, from eau de parfum down to body sprays.']::TEXT[],
    pull_quote     = 'Armaf does not book factory time. It owns the calendar.',
    stats          = '[{"label": "Sterling est.", "value": "1998"}, {"label": "Home", "value": "Dubai, UAE"}, {"label": "Club de Nuit from", "value": "2015"}, {"label": "Lines carried", "value": "3"}]'::jsonb,
    accent_hex     = '#CFC6B0',
    deep_hex       = '#0B0B0D',
    mist_hex       = '#F2EEE7',
    hero_image     = '/brands/armaf-hero.jpg',
    texture_image  = '/brands/armaf-texture.jpg',
    cover_image    = '/brands/armaf-hero.jpg',
    description    = 'Sterling Parfums has made fragrance in Dubai since 1998; Armaf is the name it puts on its own glass.'
WHERE id = 'armaf';

-- ── french-avenue ───────────────────────────────────────────────────────────
-- founded NOT ESTABLISHED — deliberately not stated as fact on the storefront. Three irreconcilable dates survived audit
-- home    VERIFIED by direct fetch of fragranceworld.ae/contact-us: 'Office no. 1806, 18th floor, Al Owais Business Towe
UPDATE public.collections SET
    story_eyebrow  = 'Dubai, by way of Paris',
    story_headline = 'A Parisian name, an Emirati house',
    story_subline  = 'The premium line of Fragrance World, catalogued since 2021, where the flacon is argued as loudly as the blend.',
    story_body     = ARRAY['The house belongs to Fragrance World Trading, a perfumery built out of Deira by Moidu P.V. — known in the Dubai trade as Poland Moosa Haji — and now run by his two sons as joint chief executives. French Avenue is its upper tier: a French name on an Emirati house, blended and shipped from an office tower in Al Sabkha, a few streets from the souk where the family first traded.', 'Its own accounts of when the line began disagree, so read it instead in the work: a catalogue that opens in 2021, hardens in 2023 with Royal Blend and Spectre, and turns loud in 2025 with Vulcan and Veneno. The method is consistent — a pillar, then a colour-coded family around it, much of it declared extrait, none of it quiet.']::TEXT[],
    pull_quote     = 'Named for Paris, made in Deira, priced for everyone.',
    stats          = '[{"label": "Home", "value": "Deira, Dubai"}, {"label": "First catalogued", "value": "2021"}, {"label": "Lines carried", "value": "2"}, {"label": "Fragrances here", "value": "12"}]'::jsonb,
    accent_hex     = '#E9A075',
    deep_hex       = '#0E0D0C',
    mist_hex       = '#F4F1EA',
    hero_image     = '/brands/french-avenue-hero.jpg',
    texture_image  = '/brands/french-avenue-texture.jpg',
    cover_image    = '/brands/french-avenue-hero.jpg',
    description    = 'The premium line of Fragrance World, catalogued since 2021, where the flacon is argued as loudly as the blend.'
WHERE id = 'french-avenue';

-- ── afnan ───────────────────────────────────────────────────────────────────
-- founded 2007
-- home    Ajman, United Arab Emirates (Jurf Industrial Area 1)
UPDATE public.collections SET
    story_eyebrow  = 'Ajman, UAE — since 2007',
    story_headline = 'The hours after nine',
    story_subline  = 'Ajman-made, and organised around one landmark release: 9PM, 2020, which the rest of the range still orbits.',
    story_body     = ARRAY['Afnan was founded in 2007 by Imran Fazlani, who remains its chairman and, by the house''s own account, the nose behind its olfactory identity. The company of record is Afnan Perfumes LLC, registered not in Dubai but in the Jurf industrial area of Ajman, where an in-house facility keeps formulation, blending and filling under one roof. Zaid Fazlani is now chief executive.', 'Its structure is a clock. Supremacy Silver, from 2013, is the oldest scent still carried here: fruit and oakmoss over musk and birch. Then 9PM landed in 2020 — apple and cinnamon collapsing into vanilla, tonka and amber — and became the reference every later release answers to: Rebel in 2024, Elixir in 2025, Night Out in 2026, with 9AM Dive holding the daylight.']::TEXT[],
    pull_quote     = 'The chairman is also the nose.',
    stats          = '[{"label": "Founded", "value": "2007"}, {"label": "Home", "value": "Ajman, UAE"}, {"label": "Breakout", "value": "9PM, 2020"}, {"label": "Fragrances here", "value": "9"}]'::jsonb,
    accent_hex     = '#CDC58D',
    deep_hex       = '#0C0C0F',
    mist_hex       = '#F2EEE6',
    hero_image     = '/brands/afnan-hero.jpg',
    texture_image  = '/brands/afnan-texture.jpg',
    cover_image    = '/brands/afnan-hero.jpg',
    description    = 'Ajman-made, and organised around one landmark release: 9PM, 2020, which the rest of the range still orbits.'
WHERE id = 'afnan';

-- ── al-haramain ─────────────────────────────────────────────────────────────
-- founded 1970
-- home    Ajman, United Arab Emirates (registered address and manufacturing); Dubai remains the retail/commercial base
UPDATE public.collections SET
    story_eyebrow  = 'Makkah, since 1970',
    story_headline = 'Oud before anything else',
    story_subline  = 'A Makkah oud trade that moved to the Emirates, and still grades the raw material it sells.',
    story_body     = ARRAY['The house began in 1970, when Kazi Abdul Haque, a Bangladeshi trader, encountered oudh in Makkah and began dealing in it. Its name refers to the two holy mosques. The business later followed its customers to the Emirates, opening its first UAE shop in Dubai in 1981, and it has remained in family hands since.', 'Production sits in Ajman now, on a campus where agarwood is graded and processed, formulas are built, and bottles are filled in one place. That control is the argument: the house composes with material it has handled from the raw wood onward. Amber Oud, introduced in 2018, carried that traditional footing into a broader contemporary register.']::TEXT[],
    pull_quote     = 'The wood is handled long before it is a fragrance',
    stats          = '[{"label": "Founded", "value": "1970"}, {"label": "Origin", "value": "Makkah, KSA"}, {"label": "Home", "value": "Ajman, UAE"}, {"label": "Amber Oud since", "value": "2018"}]'::jsonb,
    accent_hex     = '#DDA96F',
    deep_hex       = '#100E0B',
    mist_hex       = '#F2EADC',
    hero_image     = '/brands/al-haramain-hero.jpg',
    texture_image  = '/brands/al-haramain-texture.jpg',
    cover_image    = '/brands/al-haramain-hero.jpg',
    description    = 'A Makkah oud trade that moved to the Emirates, and still grades the raw material it sells.'
WHERE id = 'al-haramain';

-- ── Line collections: researched olfactory descriptions ──────────────────
UPDATE public.collections SET description = 'Aromatic aquatic: bergamot, apple and cinnamon over a marine heart, drying to driftwood, grey amber and musk.' WHERE id = 'hawas';
UPDATE public.collections SET description = 'Blue Lady is a plush tuberose-jasmine musk; Blue for Men runs aromatic-spicy, mint and mandarin over pepper and geranium.' WHERE id = 'rasasi-blue';
UPDATE public.collections SET description = 'Oriental spicy: cumin, cardamom and mugwort opening onto rose and orris, settling into sandalwood, vanilla and tonka.' WHERE id = 'dareej';
UPDATE public.collections SET description = 'Bergamot and cinnamon over a dates accord, praline and roasted tonka. Boozy, spiced, and unmistakably the house signature.' WHERE id = 'khamrah';
UPDATE public.collections SET description = 'Orchid, heliotrope and tangerine on a creamy gourmand base of vanilla, musk and sandalwood. Sweet and unhurried.' WHERE id = 'yara';
UPDATE public.collections SET description = 'Pineapple, black pepper and tobacco over coffee and iris, settling into amber, vanilla, benzoin and dry woods.' WHERE id = 'asad';
UPDATE public.collections SET description = 'Colour-coded oud. Oud for Glory is saffron and smoke; Amethyst turns to rose; Sublime opens on apple and plum.' WHERE id = 'badee-al-oud';
UPDATE public.collections SET description = 'A matched pair since 2022: Rose is aldehydic white flowers, Black a fresh fougère of lavender, juniper and cedar.' WHERE id = 'fakhar';
UPDATE public.collections SET description = 'Asdaaf-branded, not Lattafa. Citrus and bergamot over white musk and aloe, into jasmine, woods and oud.' WHERE id = 'ameerat-al-arab';
UPDATE public.collections SET description = 'Running since 2016. Rouge is pear, kumquat and caramel over oakmoss; Leather turns iris, ginger and hide.' WHERE id = 'ana-abiyedh';
UPDATE public.collections SET description = 'Litchi, raspberry and violet leaf over white rose and peony, into musk and vanilla. Bright, uncomplicated, feminine.' WHERE id = 'mayar';
UPDATE public.collections SET description = 'Patisserie, literally. Caramel, milk and sugar over honey and white flowers, closing on vanilla, praline and musk.' WHERE id = 'eclaire';
UPDATE public.collections SET description = 'The Al Noble trio, 2022. Ameer is oud and clove; Wazeer boozy-woody; Safeer citrus, caramel and guaiac.' WHERE id = 'noble';
UPDATE public.collections SET description = 'Spelled Maahir on the bottle, capped with a horse''s head. Legacy is lime, mint and lavender over ambroxan.' WHERE id = 'mahir';
UPDATE public.collections SET description = 'A 2024 his-and-hers pair sharing cinnamon and mahonial, resolving into vanilla, tonka bean and incense.' WHERE id = 'confession';
UPDATE public.collections SET description = 'Composed by Quentin Bisch. Bitter almond, apricot and caramel over honey and rose, into leather and labdanum.' WHERE id = 'teriaq';
UPDATE public.collections SET description = 'Musamam on the bottle. Saffron, mandarin and lavender over amberwood and cedar, into akigalawood, incense and labdanum.' WHERE id = 'musammam';
UPDATE public.collections SET description = 'Apple and bergamot lit with cinnamon over woods, musk and vanilla. Fresh-spicy, built for daily wear.' WHERE id = 'hayaati';
UPDATE public.collections SET description = 'Catalogued as Now by Rave. Pineapple, blackcurrant and apple over patchouli and birch, into oakmoss and ambergris.' WHERE id = 'rave-now';
UPDATE public.collections SET description = 'Nocturnal and dense: smoky pineapple and birch, citrus-floral musk, saffron amberwood, oud and chypre, EDT through extrait.' WHERE id = 'club-de-nuit';
UPDATE public.collections SET description = 'Bright, sweet, social. Mandarin and saffron over caramel and tonka, plus literal gourmands: chocolate, pistachio, toffee coffee.' WHERE id = 'odyssey';
UPDATE public.collections SET description = 'Extrait trio, 2025. Feu is mango and ginger over praline; Baie fizzy berry and vodka; Sable whiskey, anise, vanilla.' WHERE id = 'vulcan';
UPDATE public.collections SET description = 'Ghost opens ginger and pink pepper onto Turkish rose, vanilla and ambergris. Wraith is rum, coffee and sugarcane.' WHERE id = 'fa-spectre';
UPDATE public.collections SET description = 'Apple and cinnamon over lavender, falling into vanilla, tonka, amber and patchouli. Sweet, warm, high-projection after dark.' WHERE id = '9pm';
UPDATE public.collections SET description = 'Saffron, lavender and nutmeg over agarwood, closing on musk and patchouli. Extrait strength, sparse by design.' WHERE id = 'supremacy';
UPDATE public.collections SET description = 'The modern core: amber and woods under fruit or spice, closing sweet on vanilla and musk.' WHERE id = 'amber-oud';

-- No researched blurb matched these lines; they keep their seeded description:
--   precioux

-- ── Catalogue correction ────────────────────────────────────────────────────────────────
-- The seed named product 1031 "Blue For Lady"; the actual Rasasi product is "Blue Lady".
-- Migration 25 inserts with ON CONFLICT DO NOTHING, so an already-applied database needs
-- this explicit update.
UPDATE public.products SET name = 'Blue Lady' WHERE id = 1031 AND name = 'Blue For Lady';
