import { DomainError } from '../domain/errors.js';
import { newId, referenceCode } from '../domain/ids.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { MAX_TICKETS_PER_BOOKING, seatsLeft } from '../domain/inventory.js';
import { requireUser } from './eventService.js';

export function createBookingService(repository, paymentGateway) {
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
      createdAt: new Date().toISOString(),
    };
    return repository.saveBooking(booking);
  }

  async function payBooking(userId, reference, input = {}) {
    const user = requireUser(userId);
    const booking = await mustGetOwnBooking(user, reference);

    // Check the rule BEFORE any money moves. A paid or cancelled booking stops here.
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

    assertTransition(booking.status, 'cancelled');
    if (booking.status === 'paid') {
      throw new DomainError('INVALID_STATE', 'Paid bookings cannot be cancelled yet (refunds come in Build 8)');
    }

    const tier = await repository.getTier(booking.tierId);
    tier.sold -= booking.quantity;
    await repository.saveTier(tier);

    booking.status = 'cancelled';
    return repository.saveBooking(booking);
  }

  return { bookTickets, payBooking, cancelBooking };
}