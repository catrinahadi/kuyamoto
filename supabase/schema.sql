-- ================================================
-- STEP 1: DROP everything cleanly
-- ================================================
DROP TABLE IF EXISTS service_items CASCADE;
DROP TABLE IF EXISTS service_records CASCADE;
DROP TABLE IF EXISTS quotation_items CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS service_catalog_items CASCADE;
DROP TABLE IF EXISTS service_catalog CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP SEQUENCE IF EXISTS customers_customer_number_seq;
DROP SEQUENCE IF EXISTS quotations_quotation_number_seq;
DROP SEQUENCE IF EXISTS service_records_service_number_seq;

-- ================================================
-- STEP 2: CREATE TABLES
-- ================================================

-- 1. Profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Customers
CREATE SEQUENCE customers_customer_number_seq START 1;
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_number INTEGER DEFAULT nextval('customers_customer_number_seq'),
    name TEXT NOT NULL,
    contact_number TEXT,
    email TEXT,
    address TEXT,
    social_media TEXT,
    source TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Vehicles
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    make TEXT,
    model TEXT,
    year INTEGER,
    cc TEXT,
    size TEXT,
    plate_number TEXT,
    vin TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Inventory Items
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('INVENTORY', 'LABOR', 'TOOLS')),
    unit TEXT NOT NULL,
    quantity_in_stock NUMERIC DEFAULT 0,
    minimum_stock_level NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Service Catalog
CREATE TABLE service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    description TEXT,
    labor_cost NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Service Catalog Items
CREATE TABLE service_catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_required NUMERIC DEFAULT 1
);

-- 7. Quotations
CREATE SEQUENCE quotations_quotation_number_seq START 1;
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number INTEGER DEFAULT nextval('quotations_quotation_number_seq'),
    date DATE DEFAULT CURRENT_DATE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    estimated_labor_cost NUMERIC DEFAULT 0,
    estimated_parts_cost NUMERIC DEFAULT 0,
    total_estimated_cost NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Converted')),
    remarks TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. Quotation Items
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('service', 'part')),
    description TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0
);

-- 9. Service Records
CREATE SEQUENCE service_records_service_number_seq START 1;
CREATE TABLE service_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_number INTEGER DEFAULT nextval('service_records_service_number_seq'),
    quotation_id UUID REFERENCES quotations(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    service_date DATE DEFAULT CURRENT_DATE,
    technician TEXT,
    labor_cost NUMERIC DEFAULT 0,
    parts_cost NUMERIC DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    remarks TEXT,
    mileage TEXT,
    customer_review TEXT,
    mechanic_review TEXT,
    mechanic_recommendation TEXT,
    service_end_date DATE,
    warranty_end_date DATE,
    created_by TEXT,
    status TEXT DEFAULT 'Ongoing' CHECK (status IN ('Ongoing', 'Done', 'Onhold', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. Service Items
CREATE TABLE service_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_record_id UUID NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0
);

-- ================================================
-- STEP 3: ROW LEVEL SECURITY
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_all ON customers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vehicles_all ON vehicles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_all ON inventory_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_all ON service_catalog FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE service_catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_items_all ON service_catalog_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotations_all ON quotations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotation_items_all ON quotation_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_records_all ON service_records FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_items_all ON service_items FOR ALL USING (true) WITH CHECK (true);

-- ================================================
-- STEP 4: SEED DATA
-- ================================================

-- Inventory
INSERT INTO inventory_items (id, item_name, category, unit, quantity_in_stock, minimum_stock_level, cost_price, selling_price) VALUES
    ('10000000-0000-0000-0000-000000000001', 'OILCHANGE_OPENINGPROMO2026', 'LABOR', 'EA', 100, 0, 0, 10),
    ('10000000-0000-0000-0000-000000000002', 'Engine Oil - Motul 7100 10W50 1L', 'INVENTORY', 'EA', 25, 5, 17, 20),
    ('10000000-0000-0000-0000-000000000003', 'Replace Chain', 'LABOR', 'EA', 15, 0, 0, 25),
    ('10000000-0000-0000-0000-000000000004', 'Repair - Clutch', 'LABOR', 'EA', 10, 0, 0, 50),
    ('10000000-0000-0000-0000-000000000005', 'Immobilizer Bypass', 'LABOR', 'EA', 5, 0, 0, 50),
    ('10000000-0000-0000-0000-000000000006', 'Repair - Fuel Pump', 'LABOR', 'EA', 8, 0, 0, 20),
    ('10000000-0000-0000-0000-000000000007', 'Repair - Signal Lights', 'LABOR', 'EA', 20, 0, 0, 20),
    ('10000000-0000-0000-0000-000000000008', 'Brake Fluid Flush', 'LABOR', 'EA', 30, 0, 0, 20),
    ('10000000-0000-0000-0000-000000000009', 'Brake Fluid', 'INVENTORY', 'EA', 20, 5, 12, 20),
    ('10000000-0000-0000-0000-000000000010', 'Replace Brake Pad', 'LABOR', 'EA', 50, 0, 0, 25),
    ('10000000-0000-0000-0000-000000000011', 'Clean Air Filter', 'LABOR', 'EA', 20, 0, 0, 25);

-- Customers
INSERT INTO customers (id, customer_number, name, contact_number, email, social_media, source, created_by, created_at) VALUES
    ('aa000000-0000-0000-0000-000000000001', 1, 'Jhanric Lagado', '+65 8684 8977', 'jhanric@example.com', NULL, 'Family', 'Jhearic', '2026-04-30T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000002', 2, 'JHEARIC', '+65 9169 8536', 'jhearic@example.com', NULL, 'Family', 'Jhearic', '2026-05-01T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000003', 3, 'APIZ', '88834607', 'apiz@example.com', 'apizmikaelson', 'Friends', 'Nica', '2026-05-17T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000004', 4, 'HASHIM', '+65 9336 0542', 'hashim@example.com', NULL, 'Friends', 'Nica', '2026-05-31T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000005', 5, 'HUZAIFAH', '+65 8742 3719', 'huzaifah@example.com', NULL, 'Friends', 'Jhearic', '2026-05-05T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000006', 6, 'Rhijane Lagado', NULL, 'rhijane@example.com', NULL, 'Family', 'Jhearic', '2026-04-30T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000007', 7, 'Joshua Casala', NULL, 'joshua@example.com', NULL, 'Family', 'Jhearic', '2026-04-30T10:00:00Z'),
    ('aa000000-0000-0000-0000-000000000008', 8, 'MONICA', NULL, 'monica@example.com', NULL, 'Family', 'Nica', '2026-05-01T10:00:00Z');

-- Advance sequence past seeded values
SELECT setval('customers_customer_number_seq', 8);

-- Vehicles
INSERT INTO vehicles (id, customer_id, make, model, year, cc, size, plate_number, created_by, created_at) VALUES
    ('bb000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'HONDA', 'CB190R', NULL, '190', 'Lower Mid <= 400', 'FBN6704R', 'Jhearic', '2026-04-30T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000002', 'DUCATI', 'MULTISTRADA', NULL, '1200', 'SuperBike > 1000', 'FBK4010M', 'Jhearic', '2026-05-01T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000003', 'YAMAHA', 'MT09 SP', 2024, '900', 'Big Bike <= 1000', 'FBW9367M', 'Nica', '2026-05-17T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000004', 'TRIUMPH', 'Street Triple', NULL, '765', 'Big Bike <= 1000', 'FBY5809X', 'Nica', '2026-05-31T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000005', 'YAMAHA', 'FZ1', NULL, '1000', 'Big Bike <= 1000', 'FBE5811T', 'Nica', '2026-05-31T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-000000000006', 'Other', 'DONALD', NULL, NULL, NULL, 'DONALD', 'Jhearic', '2026-04-30T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000007', 'aa000000-0000-0000-0000-000000000007', 'Other', 'Jhan old', NULL, NULL, NULL, 'JHAN-OLD', 'Jhearic', '2026-04-30T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000008', 'Other', 'Other', NULL, NULL, NULL, 'FFF1234D', 'Nica', '2026-05-01T10:00:00Z'),
    ('bb000000-0000-0000-0000-000000000009', 'aa000000-0000-0000-0000-000000000001', 'Other', 'Jhan old', NULL, NULL, NULL, 'JHAN-OLD2', 'Jhearic', '2026-04-30T10:00:00Z');

-- Quotations
INSERT INTO quotations (id, quotation_number, date, customer_id, vehicle_id, estimated_labor_cost, estimated_parts_cost, total_estimated_cost, status, remarks, created_by, created_at) VALUES
    ('dd000000-0000-0000-0000-000000000001', 1, '2026-05-17', 'aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000003', 10, 45, 55, 'Converted', '', 'Nica', '2026-05-17T11:00:00Z'),
    ('dd000000-0000-0000-0000-000000000002', 2, '2026-05-31', 'aa000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000004', 0, 50, 50, 'Converted', '', 'Jhearic', '2026-05-31T11:00:00Z'),
    ('dd000000-0000-0000-0000-000000000003', 3, '2026-05-05', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000005', 0, 50, 50, 'Converted', '', 'Jhearic', '2026-05-05T11:00:00Z'),
    ('dd000000-0000-0000-0000-000000000004', 4, '2026-05-17', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000005', 0, 20, 20, 'Converted', '', 'Jhearic', '2026-05-17T11:00:00Z'),
    ('dd000000-0000-0000-0000-000000000005', 5, '2026-06-01', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000005', 0, 20, 20, 'Converted', '', 'Jhearic', '2026-06-01T11:00:00Z');

SELECT setval('quotations_quotation_number_seq', 5);

-- Quotation Items
INSERT INTO quotation_items (quotation_id, item_type, description, quantity, unit_price, total_price) VALUES
    ('dd000000-0000-0000-0000-000000000001', 'service', 'OILCHANGE_OPENINGPROMO2026', 1, 10, 10),
    ('dd000000-0000-0000-0000-000000000001', 'part', 'Engine Oil - Motul 7100 10W50 1L', 1, 20, 20),
    ('dd000000-0000-0000-0000-000000000001', 'part', 'Replace Chain', 1, 25, 25),
    ('dd000000-0000-0000-0000-000000000002', 'part', 'Repair - Clutch', 1, 50, 50),
    ('dd000000-0000-0000-0000-000000000003', 'part', 'Immobilizer Bypass', 1, 50, 50),
    ('dd000000-0000-0000-0000-000000000004', 'part', 'Repair - Fuel Pump', 1, 20, 20),
    ('dd000000-0000-0000-0000-000000000005', 'part', 'Repair - Signal Lights', 1, 20, 20);

-- Service Records
INSERT INTO service_records (id, service_number, quotation_id, customer_id, vehicle_id, service_date, technician, labor_cost, parts_cost, total_cost, remarks, mileage, customer_review, mechanic_review, mechanic_recommendation, service_end_date, warranty_end_date, created_by, status) VALUES
    ('ee000000-0000-0000-0000-000000000001', 1, NULL, 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000009', '2025-04-30', 'Jhearic', 0, 0, 0, '', '1900KM', '', '', 'Be back for 1500KM', '2025-04-30', '2026-04-30', 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000002', 2, NULL, 'aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000002', '2026-01-05', 'Jhearic', 0, 0, 0, '', '150000KM', '', '', 'FOR MAINTENANCE', '2026-02-06', '2026-02-05', 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000003', 3, NULL, 'aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000009', '2026-01-05', 'Jhearic', 0, 0, 0, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000004', 4, NULL, 'aa000000-0000-0000-0000-000000000006', 'bb000000-0000-0000-0000-000000000006', '2026-04-30', 'Jhearic', 0, 0, 0, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000005', 5, NULL, 'aa000000-0000-0000-0000-000000000007', 'bb000000-0000-0000-0000-000000000007', '2026-04-30', 'Jhearic', 0, 0, 0, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000006', 6, NULL, 'aa000000-0000-0000-0000-000000000008', 'bb000000-0000-0000-0000-000000000008', '2026-05-01', 'Jhearic', 0, 0, 0, '', '12000KM', '', '', '', NULL, NULL, 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000007', 7, NULL, 'aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', '2026-04-02', 'Jhearic', 0, 0, 0, '', '1200', '', '', '', NULL, NULL, 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000008', 8, NULL, 'aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000003', '2026-05-05', 'Jhearic', 0, 0, 0, '', '32456', '', '', 'COOLANT TOP UP', '2026-05-05', '2026-06-05', 'Jhearic', 'Done'),
    ('ee000000-0000-0000-0000-000000000009', 9, 'dd000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000003', '2026-05-17', 'Jhearic', 10, 45, 55, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Ongoing'),
    ('ee000000-0000-0000-0000-000000000010', 10, 'dd000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000004', '2026-05-31', 'Jhearic', 0, 50, 50, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Ongoing'),
    ('ee000000-0000-0000-0000-000000000011', 11, 'dd000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000005', '2026-05-31', 'Jhearic', 0, 50, 50, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Ongoing'),
    ('ee000000-0000-0000-0000-000000000012', 12, 'dd000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000005', '2026-06-01', 'Jhearic', 0, 20, 20, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Ongoing'),
    ('ee000000-0000-0000-0000-000000000013', 13, 'dd000000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000005', '2026-06-01', 'Jhearic', 0, 20, 20, '', '', '', '', '', NULL, NULL, 'Jhearic', 'Ongoing');

SELECT setval('service_records_service_number_seq', 13);

-- Service Items
INSERT INTO service_items (service_record_id, inventory_item_id, description, quantity, unit_price, total_price) VALUES
    ('ee000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'OILCHANGE_OPENINGPROMO2026', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Engine Oil - Motul 7100 10W50 1L', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000010', 'Replace Brake Pad', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Replace Chain', 30, 0, 0),
    ('ee000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Engine Oil - Motul 7100 10W50 1L', 4, 0, 0),
    ('ee000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'OILCHANGE_OPENINGPROMO2026', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000010', 'Replace Brake Pad', 2, 0, 0),
    ('ee000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Engine Oil - Motul 7100 10W50 1L', 2, 0, 0),
    ('ee000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'OILCHANGE_OPENINGPROMO2026', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000010', 'Replace Brake Pad', 4, 0, 0),
    ('ee000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000010', 'Replace Brake Pad', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'Replace Chain', 1, 0, 0),
    ('ee000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'Engine Oil - Motul 7100 10W50 1L', 3, 0, 0),
    ('ee000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'OILCHANGE_OPENINGPROMO2026', 1, 10, 10),
    ('ee000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'Engine Oil - Motul 7100 10W50 1L', 1, 20, 20),
    ('ee000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'Replace Chain', 1, 25, 25),
    ('ee000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000004', 'Repair - Clutch', 1, 50, 50),
    ('ee000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000005', 'Immobilizer Bypass', 1, 50, 50),
    ('ee000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000006', 'Repair - Fuel Pump', 1, 20, 20),
    ('ee000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000007', 'Repair - Signal Lights', 1, 20, 20);
