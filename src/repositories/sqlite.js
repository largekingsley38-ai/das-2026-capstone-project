// SQLite repository. Same methods as memory.js, so the services do not change.
// Every query uses placeholders (?). SQL is never built by joining strings.

function toEvent(row) {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
  };
}

function toTier(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function toAccount(row) {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

function toEntry(row) {
  return {
    id: row.id,
    tierId: row.tier_id,
    userId: row.user_id,
    quantity: row.quantity,
    status: row.status,
    createdAt: row.created_at,
    offerExpiresAt: row.offer_expires_at,
  };
}

function toBooking(row) {
  const booking = {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
  if (row.paid_at !== null) booking.paidAt = row.paid_at;
  if (row.charge_id !== null) booking.chargeId = row.charge_id;
  return booking;
}

export function createSqliteRepository(db) {
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)');

  const upsertEvent = db.prepare(
    `INSERT INTO events (id, organizer_id, title, city, venue, starts_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       city = excluded.city,
       venue = excluded.venue,
       starts_at = excluded.starts_at,
       status = excluded.status`,
  );
  const selectEvent = db.prepare('SELECT * FROM events WHERE id = ?');
  const selectEvents = db.prepare('SELECT * FROM events');

  const upsertTier = db.prepare(
    `INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, sold)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       price_cents = excluded.price_cents,
       capacity = excluded.capacity,
       sold = excluded.sold`,
  );
  const selectTier = db.prepare('SELECT * FROM ticket_tiers WHERE id = ?');
  const selectTiersForEvent = db.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?');

  const upsertBooking = db.prepare(
    `INSERT INTO bookings
       (id, reference, user_id, tier_id, quantity, amount_cents, status, created_at, paid_at, charge_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       paid_at = excluded.paid_at,
       charge_id = excluded.charge_id`,
  );
  const selectBookingByReference = db.prepare('SELECT * FROM bookings WHERE reference = ?');

  // ONE atomic statement: check the seats and take them in a single step.
  const reserveSeatsStmt = db.prepare(
    'UPDATE ticket_tiers SET sold = sold + ? WHERE id = ? AND sold + ? <= capacity',
  );

  return {
    // Returns true if we won the seats, false if there were not enough left.
    async reserveSeats(tierId, quantity) {
      const result = reserveSeatsStmt.run(quantity, tierId, quantity);
      return result.changes === 1;
    },
    async saveEvent(event) {
      insertUser.run(event.organizerId);
      upsertEvent.run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue ?? '',
        event.startsAt,
        event.status,
      );
      return toEvent(selectEvent.get(event.id));
    },
    async getEvent(id) {
      const row = selectEvent.get(id);
      return row ? toEvent(row) : undefined;
    },
    async listEvents() {
      return selectEvents.all().map(toEvent);
    },

    async saveTier(tier) {
      upsertTier.run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.sold);
      return toTier(selectTier.get(tier.id));
    },
    async getTier(id) {
      const row = selectTier.get(id);
      return row ? toTier(row) : undefined;
    },
    async listTiersForEvent(eventId) {
      return selectTiersForEvent.all(eventId).map(toTier);
    },

    async listPendingBookingsBefore(iso) {
      return db
        .prepare("SELECT * FROM bookings WHERE status = 'pending' AND created_at < ?")
        .all(iso)
        .map(toBooking);
    },
    async releaseSeats(tierId, quantity) {
      db.prepare('UPDATE ticket_tiers SET sold = MAX(0, sold - ?) WHERE id = ?').run(quantity, tierId);
    },
    // Compare-and-set in ONE statement: only the first caller wins.
    async changeBookingStatus(reference, from, to) {
      const result = db
        .prepare('UPDATE bookings SET status = ? WHERE reference = ? AND status = ?')
        .run(to, reference, from);
      return result.changes === 1;
    },

    async addWaitlistEntry(entry) {
      insertUser.run(entry.userId);
      db.prepare(
        'INSERT INTO waitlist_entries (id, tier_id, user_id, quantity, status, created_at, offer_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(entry.id, entry.tierId, entry.userId, entry.quantity, entry.status, entry.createdAt, entry.offerExpiresAt ?? null);
      return entry;
    },
    async getWaitlistEntry(id) {
      const row = db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(id);
      return row ? toEntry(row) : undefined;
    },
    async listWaitlist(tierId, status) {
      return db
        .prepare('SELECT * FROM waitlist_entries WHERE tier_id = ? AND status = ? ORDER BY rowid')
        .all(tierId, status)
        .map(toEntry);
    },
    async findActiveWaitlistEntry(tierId, userId) {
      const row = db
        .prepare("SELECT * FROM waitlist_entries WHERE tier_id = ? AND user_id = ? AND status IN ('waiting', 'offered')")
        .get(tierId, userId);
      return row ? toEntry(row) : undefined;
    },
    async listWaitlistForUser(userId) {
      return db
        .prepare("SELECT * FROM waitlist_entries WHERE user_id = ? AND status IN ('waiting', 'offered') ORDER BY rowid")
        .all(userId)
        .map(toEntry);
    },
    async listOffersExpiredBefore(iso) {
      return db
        .prepare("SELECT * FROM waitlist_entries WHERE status = 'offered' AND offer_expires_at <= ?")
        .all(iso)
        .map(toEntry);
    },
    // Compare-and-set in ONE statement: only the first caller wins.
    async changeWaitlistStatus(id, from, to, offerExpiresAt = null) {
      const result = db
        .prepare('UPDATE waitlist_entries SET status = ?, offer_expires_at = ? WHERE id = ? AND status = ?')
        .run(to, offerExpiresAt, id, from);
      return result.changes === 1;
    },

    async createAccount(account) {
      insertUser.run(account.id);
      // UNIQUE on email: if it is taken, nothing is inserted.
      const result = db
        .prepare('INSERT OR IGNORE INTO accounts (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(account.id, account.email, account.passwordHash, account.role, account.createdAt);
      return result.changes === 1;
    },
    async findAccountByEmail(email) {
      const row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
      return row ? toAccount(row) : undefined;
    },
    async getAccount(id) {
      const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
      return row ? toAccount(row) : undefined;
    },
    async listBookingsForUser(userId) {
      return db
        .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at')
        .all(userId)
        .map(toBooking);
    },

    async saveBooking(booking) {
      insertUser.run(booking.userId);
      upsertBooking.run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
        booking.paidAt ?? null,
        booking.chargeId ?? null,
      );
      return toBooking(selectBookingByReference.get(booking.reference));
    },
    async getBookingByReference(reference) {
      const row = selectBookingByReference.get(reference);
      return row ? toBooking(row) : undefined;
    },
  };
}