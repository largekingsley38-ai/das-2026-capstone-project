import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

// A throwaway database, so this never touches your real data.
const db = openDatabase(':memory:');
const repository = createSqliteRepository(db);
const events = createEventService(repository);
const bookings = createBookingService(repository, createMockPaymentGateway());

// An event with exactly 1 seat.
const event = await events.createEvent('org1', {
  title: 'Last Seat Show',
  city: 'Lagos',
  startsAt: '2026-12-05T18:00:00Z',
});
const tier = await events.addTier('org1', event.id, { name: 'Regular', priceCents: 5000, capacity: 1 });
await events.publishEvent('org1', event.id);

// 50 different people press Buy at the same moment.
const attempts = Array.from({ length: 50 }, (_, i) =>
  bookings.bookTickets(`user${i}`, { tierId: tier.id, quantity: 1 }).then(
    () => 'ok',
    (error) => error.code ?? error.message,
  ),
);
const results = await Promise.all(attempts);

const succeeded = results.filter((r) => r === 'ok').length;
const soldOut = results.filter((r) => r === 'SOLD_OUT').length;
const other = results.filter((r) => r !== 'ok' && r !== 'SOLD_OUT');
const finalTier = await repository.getTier(tier.id);

console.log(`Capacity:            ${finalTier.capacity}`);
console.log(`Bookings succeeded:  ${succeeded}`);
console.log(`SOLD_OUT:            ${soldOut}`);
console.log(`Other errors:        ${other.length}${other.length ? ` (${[...new Set(other)].join(', ')})` : ''}`);
console.log(`Seats sold:          ${finalTier.sold}`);
console.log(succeeded > finalTier.capacity ? 'PROBLEM: more bookings than seats!' : 'No overselling seen.');