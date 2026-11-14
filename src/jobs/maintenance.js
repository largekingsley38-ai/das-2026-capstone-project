import { createClock } from '../lib/clock.js';
import { HOLD_SECONDS } from '../domain/holdPolicy.js';

// Tests call these functions directly. The server runs run() on a timer.
export function createMaintenance({ repository, clock = createClock(), holdSeconds = HOLD_SECONDS, waitlist }) {
  async function expireUnpaidBookings() {
    const cutoff = new Date(clock.now().getTime() - holdSeconds * 1000).toISOString();
    const stale = await repository.listPendingBookingsBefore(cutoff);
    const freedTiers = new Set();
    let expired = 0;
    for (const booking of stale) {
      // Only the first caller wins, so seats are released once.
      const won = await repository.changeBookingStatus(booking.reference, 'pending', 'cancelled');
      if (won) {
        await repository.releaseSeats(booking.tierId, booking.quantity);
        freedTiers.add(booking.tierId);
        expired += 1;
      }
    }
    if (waitlist) {
      for (const tierId of freedTiers) await waitlist.offerFreedSeats(tierId);
    }
    return { expired };
  }

  async function expireWaitlistOffers() {
    return waitlist ? waitlist.expireOffers() : { expired: 0 };
  }

  async function run() {
    const bookings = await expireUnpaidBookings();
    const offers = await expireWaitlistOffers();
    return { bookingsExpired: bookings.expired, offersExpired: offers.expired };
  }

  return { expireUnpaidBookings, expireWaitlistOffers, run };
}
