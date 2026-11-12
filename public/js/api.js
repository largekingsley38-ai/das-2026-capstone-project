// The ONLY file the pages use to get data.
// Right now it reads from mockData.js. Later it can call the real server.
// Every function returns a promise, like the real API would.

import { events, tiers, HOLD_SECONDS } from './mockData.js';

const MAX_PER_BOOKING = 10;

// Copies of the data, so pages cannot change it by accident.
const tierList = tiers.map((tier) => ({ ...tier }));
const bookings = new Map();

const wait = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function seatsLeft(tier) {
  return tier.capacity - tier.sold;
}

function summary(event) {
  const own = tierList.filter((tier) => tier.eventId === event.id);
  return {
    ...event,
    cheapestPriceCents: own.length ? Math.min(...own.map((tier) => tier.priceCents)) : null,
    seatsLeft: own.reduce((total, tier) => total + seatsLeft(tier), 0),
  };
}

// options: q, city, maxPriceCents, onlyAvailable, sort (date | price | availability)
export async function listEvents(options = {}) {
  await wait();
  const { q = '', city = '', maxPriceCents, onlyAvailable = false, sort = 'date' } = options;
  const text = q.trim().toLowerCase();

  let list = events.filter((event) => event.status === 'published').map(summary);

  if (text) {
    list = list.filter((event) =>
      [event.title, event.city, event.venue].some((field) => field.toLowerCase().includes(text)),
    );
  }
  if (city) list = list.filter((event) => event.city.toLowerCase() === city.toLowerCase());
  if (typeof maxPriceCents === 'number') {
    list = list.filter((event) => event.cheapestPriceCents !== null && event.cheapestPriceCents <= maxPriceCents);
  }
  if (onlyAvailable) list = list.filter((event) => event.seatsLeft > 0);

  if (sort === 'price') {
    list.sort((a, b) => (a.cheapestPriceCents ?? Infinity) - (b.cheapestPriceCents ?? Infinity));
  } else if (sort === 'availability') {
    list.sort((a, b) => b.seatsLeft - a.seatsLeft);
  } else {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return { events: list };
}

// The real server has no "one event" route yet, so this is our own shape:
// the event plus its tiers (each with seatsLeft).
export async function getEvent(id) {
  await wait();
  const event = events.find((item) => item.id === id && item.status === 'published');
  if (!event) throw apiError('NOT_FOUND', 'Event not found');
  const own = tierList
    .filter((tier) => tier.eventId === id)
    .map((tier) => ({ ...tier, seatsLeft: seatsLeft(tier) }));
  return { event, tiers: own };
}

export async function createBooking(input = {}) {
  await wait();
  const { tierId, quantity } = input;
  const tier = tierList.find((item) => item.id === tierId);
  if (!tier) throw apiError('NOT_FOUND', 'Ticket tier not found');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_BOOKING) {
    throw apiError('VALIDATION', `quantity must be between 1 and ${MAX_PER_BOOKING}`);
  }
  const left = seatsLeft(tier);
  if (left === 0) throw apiError('SOLD_OUT', `${tier.name} is sold out`);
  if (quantity > left) throw apiError('SOLD_OUT', `Only ${left} ticket(s) left in ${tier.name}`);

  tier.sold += quantity;
  const reference = 'BK' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = Date.now();
  const booking = {
    reference,
    tierId,
    quantity,
    amountCents: tier.priceCents * quantity,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    holdExpiresAt: new Date(now + HOLD_SECONDS * 1000).toISOString(),
  };
  bookings.set(reference, booking);
  return { booking: { ...booking } };
}

// input.decline = true makes the fake card fail, like the real mock gateway.
export async function pay(reference, input = {}) {
  await wait(400);
  const booking = bookings.get(reference);
  if (!booking) throw apiError('NOT_FOUND', 'Booking not found');
  if (booking.status !== 'pending') throw apiError('INVALID_STATE', `Booking is already ${booking.status}`);
  if (Date.now() > Date.parse(booking.holdExpiresAt)) {
    throw apiError('INVALID_STATE', 'Your hold ran out. Please book again.');
  }
  if (input.decline === true) {
    throw apiError('PAYMENT_DECLINED', 'The card was declined. The booking is still pending.');
  }
  booking.status = 'paid';
  booking.paidAt = new Date().toISOString();
  return { booking: { ...booking } };
}