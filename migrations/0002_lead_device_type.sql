ALTER TABLE leads
ADD COLUMN device_type TEXT NOT NULL DEFAULT 'unknown'
CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'tv', 'unknown'));
