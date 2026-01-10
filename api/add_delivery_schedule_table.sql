-- Delivery Schedule Table Creation SQL

CREATE TABLE IF NOT EXISTS delivery_schedules (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT 1,
    procurement_staff VARCHAR(100),
    delivery_staff VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS ix_delivery_schedules_date ON delivery_schedules (date);
CREATE INDEX IF NOT EXISTS ix_delivery_schedules_id ON delivery_schedules (id);
