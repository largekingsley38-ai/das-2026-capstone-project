import { DomainError } from '../domain/errors.js';
import { newId, referenceCode } from '../domain/ids.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { MAX_TICKETS_PER_BOOKING, seatsLeft } from '../domain/inventory.js';
import { requireUser } from './eventService.js';
import { calculateRefund } from '../domain/refundPolicy.js';
import { createClock } from '../lib/clock.js';
import { HOLD_SECONDS, isHoldExpired } from '../domain/holdPolicy.js';

export function createBookingService(
  repository,
  paymentGateway,
  clock = createClock(),
  holdSeconds = HOLD_SECONDS,
) {
  // Finds a booking and checks it belongs to the caller.
  async function mustGetOwnBooking(userId, reference) {
    const booking = await repository.getBookingByReference(reference);
    if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
    if (booking.userId !== userId) {
      throw new DomainError('FORBIDDEN', 'This booking belongs to someone else');
    }
    return booking;
  }

  async function bookTickets(userId, input = {}) {
    const user = requireUser(userId);
    const { tierId, quantity } = input;

    if (typeof tierId !== 'string' || tierId === '') {
      throw new DomainError('VALIDATION', 'tierId is required');
    }
    const tier = await repository.getTier(tierId);
    if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
      throw new DomainError('VALIDATION', `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`);
    }

    const event = await repository.getEvent(tier.eventId);
    if (!event || event.status !== 'published') {
      throw new DomainError('INVALID_STATE', 'This event is not on sale');
    }

    // The database checks the seats and takes them in ONE step.
    // Only the caller that gets "true" owns the seats.
    const won = await repository.reserveSeats(tierId, quantity);
    if (!won) {
      const fresh = await repository.getTier(tierId);
      const left = seatsLeft(fresh);
      const message = left === 0 ? `${tier.name} is sold out` : `Only ${left} ticket(s) left in ${tier.name}`;
      throw new DomainError('SOLD_OUT', message, { seatsLeft: left });
    }

    let reference;
    do {
      reference = referenceCode();
    } while (await repository.getBookingByReference(reference));

    const booking = {
      id: newId(),
      reference,
      userId: user,
      tierId,
      quantity,
      amountCents: tier.priceCents * quantity,
      status: 'pending',
      createdAt: clock.now().toISOString(),
    };
    return repository.saveBooking(booking);
  }

  async function payBooking(userId, reference, input = {}) {
    const user = requireUser(userId);
    const booking = await mustGetOwnBooking(user, reference);

    // Check the rule BEFORE any money moves. A paid or cancelled booking stops here.
    // An old unpaid booking is expired: free its seats (once) and refuse the payment.
    const unpaid = booking.status === 'pending' || booking.status === 'cancelled';
    if (unpaid && isHoldExpired(booking.createdAt, clock.now(), holdSeconds)) {
      if (booking.status === 'pending') {
        const won = await repository.changeBookingStatus(reference, 'pending', 'cancelled');
        if (won) await repository.releaseSeats(booking.tierId, booking.quantity);
      }
      throw new DomainError('BOOKING_EXPIRED', 'This booking expired. Please book again.');
    }
    assertTransition(booking.status, 'paid');

    const result = await paymentGateway.charge({
      amountCents: booking.amountCents,
      reference: booking.reference,
      decline: input.decline === true,
    });
    if (!result.ok) {
      // The booking stays pending, so the attendee can try again.
      throw new DomainError('PAYMENT_DECLINED', 'The card was declined. The booking is still pending.', {
        reference: booking.reference,
      });
    }

    booking.status = 'paid';
    booking.paidAt = new Date().toISOString();
    booking.chargeId = result.chargeId;
    return repository.saveBooking(booking);
  }

  async function cancelBooking(userId, reference) {
    const user = requireUser(userId);
    const booking = await mustGetOwnBooking(user, reference);

    // Paid bookings end as "refunded", unpaid ones as "cancelled".
    const target = booking.status === 'paid' ? 'refunded' : 'cancelled';
    assertTransition(booking.status, target);

    const tier = await repository.getTier(booking.tierId);
    const changed = () => new DomainError('INVALID_STATE', 'This booking was just changed. Please refresh.');

    if (booking.status === 'pending') {
      const won = await repository.changeBookingStatus(reference, 'pending', 'cancelled');
      if (!won) throw changed();
      await repository.releaseSeats(booking.tierId, booking.quantity);
      return { ...booking, status: 'cancelled', refund: { refundCents: 0, percent: 0 } };
    }

    // Paid: work out the refund first (this throws if the event has started).
    const event = await repository.getEvent(tier.eventId);
    const refund = calculateRefund({
      amountCents: booking.amountCents,
      startsAt: event.startsAt,
      now: clock.now(),
    });

    // Only the first caller wins this step, so seats are released once.
    const won = await repository.changeBookingStatus(reference, 'paid', 'refunded');
    if (!won) throw changed();

    try {
      if (refund.refundCents > 0) {
        await paymentGateway.refund({
          chargeId: booking.chargeId,
          reference,
          amountCents: refund.refundCents,
        });
      }
    } catch (error) {
      // The money did not move, so put the booking back.
      await repository.changeBookingStatus(reference, 'refunded', 'paid');
      throw error;
    }

    await repository.releaseSeats(booking.tierId, booking.quantity);
    const saved = await repository.getBookingByReference(reference);
    return { ...saved, refund };
  }

  return { bookTickets, payBooking, cancelBooking };
}