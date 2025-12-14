-- Add producer columns to products table
-- Run this SQL directly in Railway's PostgreSQL database

-- Add cost_price column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE products ADD COLUMN cost_price INTEGER;
        COMMENT ON COLUMN products.cost_price IS '仕入れ値';
    END IF;
END $$;

-- Add harvest_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'harvest_status'
    ) THEN
        ALTER TABLE products ADD COLUMN harvest_status VARCHAR;
        COMMENT ON COLUMN products.harvest_status IS '収穫状況';
    END IF;
END $$;

-- Update alembic version to mark migration as applied
INSERT INTO alembic_version (version_num) 
VALUES ('add_producer_cols_001')
ON CONFLICT (version_num) DO NOTHING;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('cost_price', 'harvest_status');
