-- Wallet mode: coffees without a registered creator carry the pay-to address themselves.
ALTER TABLE coffees ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE coffees ADD COLUMN IF NOT EXISTS pay_to text;
CREATE INDEX IF NOT EXISTS coffees_pay_to_idx ON coffees (pay_to, created_at DESC);
