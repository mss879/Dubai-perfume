-- Rename brand names in products table
UPDATE public.products 
SET brand = 'GHARIB' 
WHERE brand = 'GHARIB PRIVÉ';

UPDATE public.products 
SET brand = 'INITIO PARFUMS' 
WHERE brand = 'INITIO PARFUMS PRIVES';

-- Update brand names in customer notes
UPDATE public.customers
SET note = REPLACE(note, 'Privé Member', 'Member')
WHERE note LIKE '%Privé Member%';

-- Update brand names in example abandoned cart
UPDATE public.abandoned_carts
SET cart_items = '[{"brand": "GHARIB", "name": "Gold Memoir", "size": "100ml", "quantity": 1, "unit_price": 203.00}, {"brand": "INITIO PARFUMS", "name": "Oud for greatness", "size": "90ml", "quantity": 1, "unit_price": 331.00}]'::jsonb
WHERE id = 'e0aebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
