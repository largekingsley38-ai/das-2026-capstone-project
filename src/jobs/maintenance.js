import { createClock } from '../lib/clock.js';
import { HOLD_SECONDS } from '../domain/holdPolicy.js';

// Tests call these functions directly. The server runs them on a timer.
export function createMaintenance({ repository, clock = createClock(), holdSeconds = HOLD_SECONDS }) {
  async function expireUnpaidBookings() {
    const cutoff = new Date(clock.now().getTime() - holdSeconds * 1000).toISOString();
    const stale = await repository.listPendingBookingsBefore(cutoff);
    let expired = 0;
    for (const booking of stale) {
      // Only the first caller wins, so seats are released once.
      const won = await repository.changeBookingStatus(booking.reference, 'pending', 'cancelled');
      if (won) {
        await repository.releaseSeats(booking.tierId, booking.quantity);
        expired += 1;
      }
    }
    return { expired };
  }

  return { expireUnpaidBookings };
}
