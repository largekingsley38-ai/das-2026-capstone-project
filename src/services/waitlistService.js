import { DomainError } from '../domain/errors.js';
import { newId, referenceCode } from '../domain/ids.js';
import { MAX_TICKETS_PER_BOOKING, seatsLeft } from '../domain/inventory.js';
import { createClock } from '../lib/clock.js';
import { requireUser } from './eventService.js';

// How long a person has to accept an offer.
export const OFFER_SECONDS = 600;

export function createWaitlistService(repository, clock = createClock(), offerSeconds = OFFER_SECONDS) {
  async function joinWaitlist(userId, input = {}) {
    const user = requireUser(userId);
    const { tierId, quantity } = input;

    if (typeof tierId !== 'string' || tierId === '') {
      throw new DomainError('VALIDATION', 'tierId is required');
    }
    const tier = await repository.getTier(tierId);
    if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
      throw new DomainError('VALIDATION', 'quantity must be between 1 and ' + MAX_TICKETS_PER_BOOKING);
    }
    if (seatsLeft(tier) >= quantity) {
      throw new DomainError('NOT_SOLD_OUT', 'Seats are available, so book them instead');
    }
    if (await repository.findActiveWaitlistEntry(tierId, user)) {
      throw new DomainError('ALREADY_ON_WAITLIST', 'You are already on the waitlist for this tier');
    }

    const entry = {
      id: newId(),
      tierId,
      userId: user,
      quantity,
      status: 'waiting',
      createdAt: clock.now().toISOString(),
      offerExpiresAt: null,
    };
    await repository.addWaitlistEntry(entry);
    const waiting = await repository.listWaitlist(tierId, 'waiting');
    return { ...entry, position: waiting.length };
  }

  // Strict first-in-first-out. The offer takes the seats (sold goes up),
  // so nobody else can book them while the offer is open.
  async function offerFreedSeats(tierId) {
    const offers = [];
    for (;;) {
      const [head] = await repository.listWaitlist(tierId, 'waiting');
      if (!head) break;
      const reserved = await repository.reserveSeats(tierId, head.quantity);
      if (!reserved) break;
      const expiresAt = new Date(clock.now().getTime() + offerSeconds * 1000).toISOString();
      const moved = await repository.changeWaitlistStatus(head.id, 'waiting', 'offered', expiresAt);
      if (!moved) {
        await repository.releaseSeats(tierId, head.quantity);
        continue;
      }
      offers.push({ ...head, status: 'offered', offerExpiresAt: expiresAt });
    }
    return offers;
  }

  // Closes one offer, gives the seats back once, and offers them to the next person.
  async function expireOffer(entry) {
    const won = await repository.changeWaitlistStatus(entry.id, 'offered', 'expired');
    if (!won) return false;
    await repository.releaseSeats(entry.tierId, entry.quantity);
    await offerFreedSeats(entry.tierId);
    return true;
  }

  async function expireOffers() {
    const stale = await repository.listOffersExpiredBefore(clock.now().toISOString());
    let expired = 0;
    for (const entry of stale) {
      if (await expireOffer(entry)) expired += 1;
    }
    return { expired };
  }

  async function acceptOffer(userId, entryId) {
    const user = requireUser(userId);
    const entry = await repository.getWaitlistEntry(entryId);
    if (!entry) throw new DomainError('NOT_FOUND', 'Waitlist entry not found');
    if (entry.userId !== user) {
      throw new DomainError('FORBIDDEN', 'This waitlist entry belongs to someone else');
    }
    if (entry.status === 'expired') throw new DomainError('OFFER_EXPIRED', 'This offer expired');
    if (entry.status !== 'offered') throw new DomainError('INVALID_STATE', 'There is no open offer to accept');

    if (clock.now().getTime() >= Date.parse(entry.offerExpiresAt)) {
      await expireOffer(entry);
      throw new DomainError('OFFER_EXPIRED', 'This offer expired');
    }

    const tier = await repository.getTier(entry.tierId);
    // Only the first caller wins. The seats are already held, so no new reserve here.
    const won = await repository.changeWaitlistStatus(entry.id, 'offered', 'accepted');
    if (!won) throw new DomainError('INVALID_STATE', 'This offer was just changed. Please refresh.');

    let reference;
    do {
      reference = referenceCode();
    } while (await repository.getBookingByReference(reference));

    return repository.saveBooking({
      id: newId(),
      reference,
      userId: user,
      tierId: entry.tierId,
      quantity: entry.quantity,
      amountCents: tier.priceCents * entry.quantity,
      status: 'pending',
      createdAt: clock.now().toISOString(),
    });
  }

  async function listMine(userId) {
    return repository.listWaitlistForUser(requireUser(userId));
  }

  return { joinWaitlist, offerFreedSeats, expireOffers, acceptOffer, listMine };
}