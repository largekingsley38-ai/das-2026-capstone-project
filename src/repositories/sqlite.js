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