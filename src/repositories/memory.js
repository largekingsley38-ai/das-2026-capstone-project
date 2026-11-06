// In-memory repository. Every method is async, like a real database would be.
// It stores COPIES, so a service cannot change saved data by accident:
// it has to call a save method.

const copy = (value) => (value === undefined ? undefined : structuredClone(value));

export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map(); // keyed by reference

  return {
    async saveEvent(event) {
      events.set(event.id, copy(event));
      return copy(event);
    },
    async getEvent(id) {
      return copy(events.get(id));
    },
    async listEvents() {
      return [...events.values()].map((event) => copy(event));
    },

    async saveTier(tier) {
      tiers.set(tier.id, copy(tier));
      return copy(tier);
    },
    async getTier(id) {
      return copy(tiers.get(id));
    },
    async listTiersForEvent(eventId) {
      return [...tiers.values()].filter((tier) => tier.eventId === eventId).map((tier) => copy(tier));
    },

    // Same job as the SQLite version: check and add in ONE step.
    // There is no await inside, so nobody can sneak in between.
    async reserveSeats(tierId, quantity) {
      const tier = tiers.get(tierId);
      if (!tier) return false;
      if (tier.sold + quantity > tier.capacity) return false;
      tier.sold += quantity;
      return true;
    },

    async saveBooking(booking) {
      bookings.set(booking.reference, copy(booking));
      return copy(booking);
    },
    async getBookingByReference(reference) {
      return copy(bookings.get(reference));
    },
  };
}