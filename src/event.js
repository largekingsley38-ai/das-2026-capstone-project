const { Waitlist } = require('./waitlist');

class Event {
  constructor(name) {
    this.name = name;
    this.tiers = new Map(); // tier name -> price, capacity, sold, waitlist
    this.bookings = new Map(); // reference code -> booking
    this.nextNumber = 1;
  }

  addTier(tierName, priceKobo, capacity) {
    if (!Number.isInteger(priceKobo) || priceKobo < 0) {
      throw new Error('Price must be a whole number of kobo');
    }
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Capacity must be a whole number, at least 1');
    }
    this.tiers.set(tierName, {
      priceKobo,
      capacity,
      sold: 0,
      waitlist: new Waitlist(),
    });
  }

  // The capacity rule lives here
  book(tierName, buyer) {
    const tier = this.tiers.get(tierName);
    if (!tier) throw new Error('No such tier: ' + tierName);
    if (tier.sold >= tier.capacity) {
      return { ok: false, reason: 'sold out' };
    }
    tier.sold++;
    const reference = 'BK-' + String(this.nextNumber++).padStart(4, '0');
    const booking = { reference, buyer, tierName, priceKobo: tier.priceKobo };
    this.bookings.set(reference, booking);
    return { ok: true, booking };
  }

  joinWaitlist(tierName, buyer) {
    const tier = this.tiers.get(tierName);
    if (!tier) throw new Error('No such tier: ' + tierName);
    tier.waitlist.enqueue(buyer);
    return tier.waitlist.length;
  }

  findBooking(reference) {
    return this.bookings.get(reference) || null;
  }
}

module.exports = { Event };
