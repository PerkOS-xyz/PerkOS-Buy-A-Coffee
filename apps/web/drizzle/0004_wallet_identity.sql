-- Creators are identified by wallet (Privy login + signed challenge). Email becomes optional.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS wallet text;
ALTER TABLE creators ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creators_wallet_idx ON creators (wallet);
UPDATE creators SET wallet = lower(pay_to) WHERE wallet IS NULL AND pay_to IS NOT NULL;
