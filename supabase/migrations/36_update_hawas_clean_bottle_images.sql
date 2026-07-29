-- Migration 36: Update Hawas Flankers to Clean Signature Bottle Photography
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- Replaces mismatched bottle subtitle images with clean, un-edited Hawas signature bottle photos.
-- Ensures Hawas Atlantis, Malibu, Kobra, etc. show pure HAWAS branding without conflicting "ICE" or "for Him" text.

UPDATE public.products SET
  image_url = '/products/hawas-ice.png',
  image_urls = ARRAY['/products/hawas-ice.png']::TEXT[]
WHERE id = 1000; -- Hawas Ice (Exact match)

UPDATE public.products SET
  image_url = '/products/hawas-men.png',
  image_urls = ARRAY['/products/hawas-men.png']::TEXT[]
WHERE id = 1001; -- Hawas for Him (Exact match)

UPDATE public.products SET
  image_url = '/products/hawas-for-her.png',
  image_urls = ARRAY['/products/hawas-for-her.png']::TEXT[]
WHERE id = 1002; -- Hawas for Her (Exact match)

UPDATE public.products SET
  image_url = '/products/hawas-femme.png',
  image_urls = ARRAY['/products/hawas-femme.png']::TEXT[]
WHERE id = 1003; -- Hawas Diva

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1004; -- Hawas Malibu

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1005; -- Hawas Kobra

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1006; -- Hawas Chrome

UPDATE public.products SET
  image_url = '/products/hawas-signature.png',
  image_urls = ARRAY['/products/hawas-signature.png']::TEXT[]
WHERE id = 1007; -- Hawas Majestic

UPDATE public.products SET
  image_url = '/products/hawas-femme.png',
  image_urls = ARRAY['/products/hawas-femme.png']::TEXT[]
WHERE id = 1008; -- Hawas Eclat

UPDATE public.products SET
  image_url = '/products/hawas-signature.png',
  image_urls = ARRAY['/products/hawas-signature.png']::TEXT[]
WHERE id = 1009; -- Hawas Fire

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1010; -- Hawas Atlantis

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1011; -- Hawas Viper

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1012; -- Hawas Sapphire

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1013; -- Hawas Thunder

UPDATE public.products SET
  image_url = '/products/hawas-femme.png',
  image_urls = ARRAY['/products/hawas-femme.png']::TEXT[]
WHERE id = 1014; -- Hawas Pink

UPDATE public.products SET
  image_url = '/products/hawas-signature.png',
  image_urls = ARRAY['/products/hawas-signature.png']::TEXT[]
WHERE id = 1015; -- Hawas Exotic

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1016; -- Hawas Highness

UPDATE public.products SET
  image_url = '/products/hawas-signature.png',
  image_urls = ARRAY['/products/hawas-signature.png']::TEXT[]
WHERE id = 1017; -- Hawas Lava Gold

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1018; -- Hawas Overdose

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1019; -- Hawas Nautilus

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1020; -- Hawas London

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1021; -- Hawas Tropical

UPDATE public.products SET
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1022; -- Hawas Verde

UPDATE public.products SET
  image_url = '/products/hawas-femme.png',
  image_urls = ARRAY['/products/hawas-femme.png']::TEXT[]
WHERE id = 1023; -- Hawas Reina

UPDATE public.products SET
  image_url = '/products/hawas-femme.png',
  image_urls = ARRAY['/products/hawas-femme.png']::TEXT[]
WHERE id = 1024; -- Hawas Addiction

UPDATE public.products SET
  name = 'Hawas La''meir',
  image_url = '/products/hawas-fresh.png',
  image_urls = ARRAY['/products/hawas-fresh.png']::TEXT[]
WHERE id = 1025; -- Hawas La'meir

UPDATE public.products SET
  image_url = '/products/hawas-signature.png',
  image_urls = ARRAY['/products/hawas-signature.png']::TEXT[]
WHERE id = 1026; -- Hawas Gold Digger

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1027; -- Hawas Elixir

UPDATE public.products SET
  image_url = '/products/hawas-black.png',
  image_urls = ARRAY['/products/hawas-black.png']::TEXT[]
WHERE id = 1028; -- Hawas Black
