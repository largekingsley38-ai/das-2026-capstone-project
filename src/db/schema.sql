-- Build 5 schema. Every rule the database can enforce, it enforces.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  city TEXT NOT NULL CHECK (length(trim(city)) > 0),
  venue TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published'))
);

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  -- Money is whole cents.
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  sold INTEGER NOT NULL DEFAULT 0,
  CHECK (sold >= 0 AND sold <= capacity)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  tier_id TEXT NOT NULL REFERENCES ticket_tiers(id),
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'checked_in')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  charge_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_tiers_event ON ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tier ON bookings(tier_id);