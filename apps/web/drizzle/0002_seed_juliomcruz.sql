-- First creator: Julio M Cruz. Idempotent (re-runs only refresh the profile fields).
INSERT INTO creators (email, handle, pay_to, display_name, avatar_url, message, default_amounts, allowed_origins, active)
VALUES (
  'julio.cruz@eb-ms.net',
  'juliomcruz',
  '0xc2564e41b7f5cb66d2d99466450cfebce9e8228f',
  'Julio M Cruz',
  'https://www.juliomcruz.xyz/julio-320.jpg',
  'Senior software engineer. 25 years of production systems, six under a Top Secret clearance, AI-agent infrastructure today. If something here helped you, a coffee is welcome.',
  '[5,10,50]'::jsonb,
  '["https://www.juliomcruz.xyz","https://juliomcruz.xyz","https://github.com"]'::jsonb,
  true
)
ON CONFLICT (email) DO UPDATE SET
  handle = EXCLUDED.handle,
  pay_to = EXCLUDED.pay_to,
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  message = EXCLUDED.message,
  default_amounts = EXCLUDED.default_amounts,
  allowed_origins = EXCLUDED.allowed_origins,
  active = true,
  updated_at = now();
