CREATE TABLE IF NOT EXISTS creators (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  handle        text UNIQUE,
  pay_to        text,
  display_name  text,
  avatar_url    text,
  message       text,
  default_amounts jsonb NOT NULL DEFAULT '[5,10,50]'::jsonb,
  allowed_origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creators_handle_idx ON creators (handle);

CREATE TABLE IF NOT EXISTS coffees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coffee_id     text NOT NULL UNIQUE,
  creator_id    uuid NOT NULL REFERENCES creators(id),
  network       text NOT NULL,
  amount        numeric(18,6) NOT NULL,
  fee           numeric(18,6),
  from_address  text,
  tx_hash       text,
  status        text NOT NULL DEFAULT 'pending',
  memo          text,
  return_to     text,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  settled_at    timestamptz
);
CREATE INDEX IF NOT EXISTS coffees_creator_idx ON coffees (creator_id, created_at DESC);

CREATE TABLE IF NOT EXISTS login_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz
);
