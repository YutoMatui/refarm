-- Add producer columns to products table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE products ADD COLUMN cost_price INTEGER;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'harvest_status'
    ) THEN
        ALTER TABLE products ADD COLUMN harvest_status VARCHAR;
    END IF;
END $$;

DELETE FROM alembic_version WHERE version_num = 'add_producer_cols_001';
INSERT INTO alembic_version (version_num) VALUES ('add_producer_cols_001');

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('cost_price', 'harvest_status');
