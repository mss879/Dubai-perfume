-- Create inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES public.products(id) ON DELETE CASCADE,
    size VARCHAR(50) NOT NULL,
    stock_level INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_product_size UNIQUE (product_id, size)
);

-- Create purchase orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id VARCHAR(100) PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, ordered, received, cancelled
    items JSONB NOT NULL, -- list of items with qty, cost, sizes
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transfers table
CREATE TABLE IF NOT EXISTS public.transfers (
    id VARCHAR(100) PRIMARY KEY,
    origin VARCHAR(255) NOT NULL, -- e.g. Main Warehouse
    destination VARCHAR(255) NOT NULL, -- e.g. Dubai Mall Retail
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_transit, completed, cancelled
    items JSONB NOT NULL, -- list of items transferred
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Seed inventory levels for existing seeded products
INSERT INTO public.inventory (product_id, size, stock_level, low_stock_threshold) VALUES
(101, '50ml', 45, 10),
(101, '100ml', 25, 5),
(102, '30ml', 80, 15),
(102, '50ml', 65, 10),
(103, '50ml', 12, 5),
(103, '100ml', 8, 3),
(104, '50ml', 35, 8),
(104, '100ml', 19, 5),
(1, '50ml', 14, 5),
(1, '90ml', 9, 3),
(2, '30ml', 24, 5),
(2, '50ml', 18, 5),
(3, '50ml', 40, 10),
(3, '100ml', 30, 8),
(4, '75ml', 6, 2),
(5, '30ml', 15, 3),
(5, '50ml', 22, 5),
(5, '100ml', 11, 3),
(6, '30ml', 55, 10),
(6, '50ml', 48, 8),
(6, '100ml', 32, 5),
(7, '50ml', 4, 3),
(7, '100ml', 2, 2),
(8, '100ml', 3, 2),
(9, '30ml', 7, 2),
(9, '50ml', 5, 2)
ON CONFLICT (product_id, size) DO UPDATE SET stock_level = EXCLUDED.stock_level, low_stock_threshold = EXCLUDED.low_stock_threshold;

-- Seed Purchase Orders (Mocks)
INSERT INTO public.purchase_orders (id, supplier_name, status, items, total_cost) VALUES
('PO-2026-001', 'France Scent Labs Co.', 'received', '[{"id": 1, "name": "Oud for greatness", "size": "90ml", "qty": 15, "cost": 150.00}]'::jsonb, 2250.00),
('PO-2026-002', 'Italian Glassworks SpA', 'ordered', '[{"id": 7, "name": "Epicentro", "size": "100ml", "qty": 10, "cost": 180.00}]'::jsonb, 1800.00),
('PO-2026-003', 'Gharib Blending Labs', 'draft', '[{"id": 101, "name": "Gold Memoir", "size": "100ml", "qty": 50, "cost": 85.00}]'::jsonb, 4250.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Transfers (Mocks)
INSERT INTO public.transfers (id, origin, destination, status, items) VALUES
('TF-2026-001', 'Main Dubai Vault', 'Dubai Mall Flagship Store', 'completed', '[{"id": 101, "name": "Gold Memoir", "size": "100ml", "qty": 10}]'::jsonb),
('TF-2026-002', 'Main Dubai Vault', 'Marina Mall Boutique', 'in_transit', '[{"id": 102, "name": "Enchanted Blooms", "size": "50ml", "qty": 15}]'::jsonb),
('TF-2026-003', 'Marina Mall Boutique', 'Main Dubai Vault', 'pending', '[{"id": 103, "name": "Mystic Oud", "size": "50ml", "qty": 5}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
