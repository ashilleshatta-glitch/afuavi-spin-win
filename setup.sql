CREATE TABLE IF NOT EXISTS campaign_limits (
  id INTEGER PRIMARY KEY,
  max_winners INTEGER NOT NULL CHECK (max_winners > 0),
  winners_so_far INTEGER NOT NULL DEFAULT 0 CHECK (winners_so_far >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (winners_so_far <= max_winners)
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  has_spun BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prize_tiers (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  prize_type TEXT NOT NULL CHECK (prize_type IN ('discount', 'prize')),
  discount_percentage INTEGER CHECK (discount_percentage > 0),
  max_winners INTEGER NOT NULL CHECK (max_winners > 0),
  winners_so_far INTEGER NOT NULL DEFAULT 0 CHECK (winners_so_far >= 0),
  priority INTEGER NOT NULL DEFAULT 1,
  CHECK (
    (prize_type = 'discount' AND discount_percentage IS NOT NULL) OR
    (prize_type = 'prize' AND discount_percentage IS NULL)
  ),
  CHECK (winners_so_far <= max_winners)
);

CREATE TABLE IF NOT EXISTS spins (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  won BOOLEAN NOT NULL,
  prize_tier_id INTEGER REFERENCES prize_tiers(id),
  prize_label TEXT,
  discount_percentage INTEGER,
  discount_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_spin_per_customer UNIQUE (customer_id)
);

CREATE TABLE IF NOT EXISTS redemptions (
  id BIGSERIAL PRIMARY KEY,
  discount_code TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  prize_tier_id INTEGER REFERENCES prize_tiers(id),
  prize_label TEXT,
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0),
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO campaign_limits (id, max_winners, winners_so_far)
VALUES (1, 15, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO prize_tiers (label, prize_type, discount_percentage, max_winners, winners_so_far, priority)
VALUES
  ('50% Off', 'discount', 50, 2, 0, 1),
  ('20% Off', 'discount', 20, 4, 0, 2),
  ('Box of Chocolate', 'prize', NULL, 4, 0, 3),
  ('10% Off', 'discount', 10, 5, 0, 4)
ON CONFLICT (label) DO NOTHING;
