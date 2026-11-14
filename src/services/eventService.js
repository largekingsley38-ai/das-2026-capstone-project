import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { searchEvents } from '../domain/eventSearch.js';
import { seatsLeft } from '../domain/inventory.js';

// Small input checks, shared with bookingService.
export function requireUser(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('UNAUTHENTICATED', 'The x-user-id header is required');
  }
  return userId.trim();
}

export function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }
  return value.trim();
}

export function requireWholeNumber(value, field, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new DomainError('VALIDATION', `${field} must be a whole number of at least ${min}`);
  }
  return value;
}

function wholeNumberFromQuery(value, field) {
  if (!/^\d+$/.test(value)) {
    throw new DomainError('VALIDATION', `${field} must be a whole number`);
  }
  return Number(value);
}

export function createEventService(repository) {
  async function mustGetEvent(eventId) {
    const event = await repository.getEvent(eventId);
    if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
    return event;
  }

  async function createEvent(userId, input = {}) {
    const organizerId = requireUser(userId);
    if (typeof input.startsAt !== 'string' || Number.isNaN(new Date(input.startsAt).getTime())) {
      throw new DomainError('VALIDATION', 'startsAt must be a valid date');
    }
    const event = {
      id: newId(),
      organizerId,
      title: requireText(input.title, 'Title'),
      city: requireText(input.city, 'City'),
      venue: String(input.venue ?? '').trim(),
      startsAt: new Date(input.startsAt).toISOString(),
      status: 'draft',
    };
    return repository.saveEvent(event);
  }

  async function addTier(userId, eventId, input = {}) {
    requireUser(userId);
    await mustGetEvent(eventId);
    const tier = {
      id: newId(),
      eventId,
      name: requireText(input.name, 'Tier name'),
      // Money is ALWAYS whole cents.
      priceCents: requireWholeNumber(input.priceCents, 'priceCents', 0),
      capacity: requireWholeNumber(input.capacity, 'capacity', 1),
      sold: 0,
    };
    return repository.saveTier(tier);
  }

  async function setStatus(userId, eventId, status) {
    requireUser(userId);
    const event = await mustGetEvent(eventId);
    if (status === 'published') {
      const tiers = await repository.listTiersForEvent(eventId);
      if (tiers.length === 0) {
        throw new DomainError('INVALID_STATE', 'An event needs at least one ticket tier to be published');
      }
    }
    event.status = status;
    return repository.saveEvent(event);
  }

  const publishEvent = (userId, eventId) => setStatus(userId, eventId, 'published');
  const unpublishEvent = (userId, eventId) => setStatus(userId, eventId, 'draft');

  // Attendees only ever see published events.
  async function searchPublishedEvents(query = {}) {
    const events = await repository.listEvents();
    const summaries = [];
    for (const event of events) {
      if (event.status !== 'published') continue;
      const tiers = await repository.listTiersForEvent(event.id);
      const prices = tiers.map((tier) => tier.priceCents);
      summaries.push({
        id: event.id,
        title: event.title,
        city: event.city,
        venue: event.venue,
        startsAt: event.startsAt,
        status: event.status,
        cheapestPriceCents: prices.length > 0 ? Math.min(...prices) : null,
        seatsLeft: tiers.reduce((total, tier) => total + seatsLeft(tier), 0),
      });
    }

    const criteria = {
      q: query.q,
      city: query.city,
      from: query.from,
      to: query.to,
      maxPriceCents:
        query.maxPriceCents === undefined ? undefined : wholeNumberFromQuery(query.maxPriceCents, 'maxPriceCents'),
      onlyAvailable: query.onlyAvailable === 'true',
    };
    return searchEvents(summaries, criteria, query.sort ?? 'date');
  }

  async function getPublishedEvent(eventId) {
    const event = await mustGetEvent(eventId);
    if (event.status !== 'published') throw new DomainError('NOT_FOUND', 'Event not found');
    const rows = await repository.listTiersForEvent(event.id);
    const tiers = rows.map((tier) => ({ ...tier, seatsLeft: seatsLeft(tier) }));
    return { event, tiers };
  }

  return { createEvent, addTier, publishEvent, unpublishEvent, searchPublishedEvents, getPublishedEvent };
}