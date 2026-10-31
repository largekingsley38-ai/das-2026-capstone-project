import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  listEventSummaries,
  bookTickets,
  seatsLeft,
} from '../src/domain/inventory.js';
import { mergeSort } from '../src/domain/sorting.js';
import { filterEvents, sortEvents, searchEvents } from '../src/domain/eventSearch.js';

function makeEvent(store, title, city, startsAt, venue = 'Hall') {
  return createEvent(store, { title, city, venue, startsAt, organizerId: 'org1' });
}

function makePublished(store, title, city, startsAt, priceCents = 1000, capacity = 10, venue = 'Hall') {
  const event = makeEvent(store, title, city, startsAt, venue);
  addTier(store, event.id, { name: 'General', priceCents, capacity });
  publishEvent(store, event.id);
  return event;
}

// ---------- S02: create event ----------
test('S02: creating an event saves a draft with a new id', () => {
  const store = createStore();
  const event = makeEvent(store, 'Jazz Night', 'Abuja', '2026-12-05T17:00:00Z');
  assert.equal(event.status, 'draft');
  assert.ok(event.id);
  assert.equal(listEventSummaries(store).length, 0);
});

test('S02: missing title, missing city or a bad date is VALIDATION', () => {
  const store = createStore();
  assert.throws(() => makeEvent(store, '', 'Lagos', '2026-12-05'), { code: 'VALIDATION' });
  assert.throws(() => makeEvent(store, 'Show', '', '2026-12-05'), { code: 'VALIDATION' });
  assert.throws(() => makeEvent(store, 'Show', 'Lagos', 'not a date'), { code: 'VALIDATION' });
  assert.equal(store.events.size, 0);
});

// ---------- S03: add tiers ----------
test('S03: adding a tier saves it with 0 sold and 100 seats left', () => {
  const store = createStore();
  const event = makeEvent(store, 'Show', 'Lagos', '2026-12-05');
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500000, capacity: 100 });
  assert.equal(tier.sold, 0);
  assert.equal(seatsLeft(tier), 100);
});

test('S03: a price that is not whole, or capacity below 1, is VALIDATION', () => {
  const store = createStore();
  const event = makeEvent(store, 'Show', 'Lagos', '2026-12-05');
  assert.throws(() => addTier(store, event.id, { name: 'A', priceCents: 10.5, capacity: 5 }), { code: 'VALIDATION' });
  assert.throws(() => addTier(store, event.id, { name: 'A', priceCents: 100, capacity: 0 }), { code: 'VALIDATION' });
});

test('S03: an unknown event id is NOT_FOUND', () => {
  const store = createStore();
  assert.throws(() => addTier(store, 'nope', { name: 'A', priceCents: 100, capacity: 5 }), { code: 'NOT_FOUND' });
});

// ---------- S04: publish ----------
test('S04: a draft with a tier can be published and appears on the public list', () => {
  const store = createStore();
  const event = makeEvent(store, 'Show', 'Lagos', '2026-12-05');
  addTier(store, event.id, { name: 'General', priceCents: 1000, capacity: 5 });
  publishEvent(store, event.id);
  assert.equal(store.events.get(event.id).status, 'published');
  assert.equal(listEventSummaries(store).length, 1);
});

test('S04: publishing with no tiers is INVALID_STATE and stays a draft', () => {
  const store = createStore();
  const event = makeEvent(store, 'Show', 'Lagos', '2026-12-05');
  assert.throws(() => publishEvent(store, event.id), { code: 'INVALID_STATE' });
  assert.equal(store.events.get(event.id).status, 'draft');
});

test('S04: drafts are not on the public list', () => {
  const store = createStore();
  makeEvent(store, 'Draft Show', 'Lagos', '2026-12-05');
  assert.equal(listEventSummaries(store).length, 0);
  assert.equal(listEventSummaries(store, { publishedOnly: false }).length, 1);
});

// ---------- S05: search, filter, sort ----------
test('S05: search text matches title ignoring case', () => {
  const store = createStore();
  makePublished(store, 'Lagos Tech Meetup', 'Lagos', '2026-12-01');
  makePublished(store, 'Abuja Jazz Night', 'Abuja', '2026-12-02');
  const result = filterEvents(listEventSummaries(store), { q: 'JAZZ' });
  assert.deepEqual(result.map((e) => e.title), ['Abuja Jazz Night']);
});

test('S05: city filter ignores capital letters', () => {
  const store = createStore();
  makePublished(store, 'A', 'Lagos', '2026-12-01');
  makePublished(store, 'B', 'Abuja', '2026-12-02');
  const result = filterEvents(listEventSummaries(store), { city: 'lagos' });
  assert.deepEqual(result.map((e) => e.title), ['A']);
});

test('S05: max price and price sort, cheapest first, no-tier events left out', () => {
  const summaries = [
    { id: '1', title: 'Pricey', city: 'X', venue: '', startsAt: '2026-12-01T10:00:00Z', cheapestPriceCents: 9000, seatsLeft: 5 },
    { id: '2', title: 'Cheap', city: 'X', venue: '', startsAt: '2026-12-02T10:00:00Z', cheapestPriceCents: 1000, seatsLeft: 5 },
    { id: '3', title: 'Mid', city: 'X', venue: '', startsAt: '2026-12-03T10:00:00Z', cheapestPriceCents: 5000, seatsLeft: 5 },
    { id: '4', title: 'None', city: 'X', venue: '', startsAt: '2026-12-04T10:00:00Z', cheapestPriceCents: null, seatsLeft: 0 },
  ];
  const result = searchEvents(summaries, { maxPriceCents: 5000 }, 'price');
  assert.deepEqual(result.map((e) => e.title), ['Cheap', 'Mid']);
});

test('S05: same-day events sort by date then stay in title order', () => {
  const summaries = [
    { id: '1', title: 'Zebra', city: 'X', venue: '', startsAt: '2026-12-05T10:00:00Z', cheapestPriceCents: 1, seatsLeft: 1 },
    { id: '2', title: 'Apple', city: 'X', venue: '', startsAt: '2026-12-05T10:00:00Z', cheapestPriceCents: 1, seatsLeft: 1 },
    { id: '3', title: 'Early', city: 'X', venue: '', startsAt: '2026-12-04T10:00:00Z', cheapestPriceCents: 1, seatsLeft: 1 },
  ];
  const result = sortEvents(summaries, 'date');
  assert.deepEqual(result.map((e) => e.title), ['Early', 'Apple', 'Zebra']);
});

test('S05: an event at 5 PM on 5 December is included by a date-only "to"', () => {
  const summaries = [
    { id: '1', title: 'Late', city: 'X', venue: '', startsAt: '2026-12-05T17:00:00Z', cheapestPriceCents: 1, seatsLeft: 1 },
  ];
  assert.equal(filterEvents(summaries, { to: '2026-12-05' }).length, 1);
});

test('S05: bad date, non-whole price or unknown sort is VALIDATION', () => {
  assert.throws(() => filterEvents([], { from: 'nonsense' }), { code: 'VALIDATION' });
  assert.throws(() => filterEvents([], { maxPriceCents: 10.5 }), { code: 'VALIDATION' });
  assert.throws(() => sortEvents([], 'colour'), { code: 'VALIDATION' });
});

test('S05: filtering and sorting never change the original list', () => {
  const original = [
    { id: '1', title: 'B', city: 'X', venue: '', startsAt: '2026-12-02T10:00:00Z', cheapestPriceCents: 2, seatsLeft: 1 },
    { id: '2', title: 'A', city: 'X', venue: '', startsAt: '2026-12-01T10:00:00Z', cheapestPriceCents: 1, seatsLeft: 2 },
  ];
  const copy = JSON.parse(JSON.stringify(original));
  filterEvents(original, { q: 'a' });
  sortEvents(original, 'price');
  searchEvents(original, { city: 'x' }, 'availability');
  assert.deepEqual(original, copy);
});

test('S05: an empty list gives an empty list', () => {
  assert.deepEqual(searchEvents([], { q: 'x' }, 'date'), []);
});

// ---------- merge sort ----------
test('mergeSort sorts, is stable, and does not change its input', () => {
  const input = [
    { n: 3, tag: 'a' },
    { n: 1, tag: 'b' },
    { n: 3, tag: 'c' },
    { n: 1, tag: 'd' },
  ];
  const copy = input.map((x) => ({ ...x }));
  const result = mergeSort(input, (x, y) => x.n - y.n);
  assert.deepEqual(result.map((x) => x.tag), ['b', 'd', 'a', 'c']);
  assert.deepEqual(input, copy);
  assert.notEqual(result, input);
});

test('mergeSort rejects bad input with VALIDATION', () => {
  assert.throws(() => mergeSort('no', (a, b) => a - b), { code: 'VALIDATION' });
  assert.throws(() => mergeSort([1], null), { code: 'VALIDATION' });
});

// ---------- S06: book tickets ----------
test('S06: booking 2 of 3 seats makes a pending booking and leaves 1', () => {
  const store = createStore();
  const event = makePublished(store, 'Show', 'Lagos', '2026-12-05', 2500, 3);
  const tierId = event.tierIds[0];
  const booking = bookTickets(store, tierId, 'user1', 2);
  assert.equal(booking.status, 'pending');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.amountCents, 5000);
  assert.equal(seatsLeft(store.tiers.get(tierId)), 1);
});
test('S06: booking more than the seats left is SOLD_OUT and changes nothing', () => {
  const store = createStore();
  const event = makePublished(store, 'Show', 'Lagos', '2026-12-05', 2500, 1);
  const tierId = event.tierIds[0];
  assert.throws(() => bookTickets(store, tierId, 'user1', 2), { code: 'SOLD_OUT' });
  assert.equal(seatsLeft(store.tiers.get(tierId)), 1);
});

test('S06: quantity 0, negative, fractional or above 10 is VALIDATION', () => {
  const store = createStore();
  const event = makePublished(store, 'Show', 'Lagos', '2026-12-05', 100, 50);
  const tierId = event.tierIds[0];
  for (const bad of [0, -1, 1.5, 11]) {
    assert.throws(() => bookTickets(store, tierId, 'user1', bad), { code: 'VALIDATION' });
  }
});
