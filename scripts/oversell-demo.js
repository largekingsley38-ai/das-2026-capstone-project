// Run with: npm run oversell
// 50 people try to buy the last seat at the same moment. It runs twice,
// each time on a fresh throwaway database:
//   1. Before: the Build 4 way. Read the tier, check in JavaScript, then save.
//      Every request reads "1 seat left" before any of them saves.
//   2. After: the real booking service, which takes the seat with one atomic
//      UPDATE and looks at how many rows changed.
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

const ATTENDEES = 50;

// The old booking code, copied here only so the bug can be seen.
function build4Book(repository) {
  return async (userId, { tierId, quantity }) => {
    const tier = await repository.getTier(tierId);
    if (tier.capacity - tier.sold < quantity) {
      const error = new Error('sold out');
      error.code = 'SOLD_OUT';
      throw error;
    }
    await repository.saveTier({ ...tier, sold: tier.sold + quantity }); // lost update
    return repository.saveBooking({
      id: randomUUID(),
      reference: randomUUID().slice(0, 8).toUpperCase(),
      userId,
      tierId,
      quantity,
      amountCents: tier.priceCents * quantity,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  };
}

async function run(label, chooseBook) {
  const db = openDatabase(':memory:');
  const repository = createSqliteRepository(db);
  const events = createEventService(repository);
  const bookings = createBookingService(repository, createMockPaymentGateway());

  const event = await events.createEvent('org1', { title: 'Last Seat Show', city: 'Lagos', startsAt: '2030-12-05T18:00:00Z' });
  const tier = await events.addTier('org1', event.id, { name: 'Regular', priceCents: 5000, capacity: 1 });
  await events.publishEvent('org1', event.id);

  const book = chooseBook({ repository, bookings });
  const results = await Promise.all(
    Array.from({ length: ATTENDEES }, (_, i) =>
      book(`user${i}`, { tierId: tier.id, quantity: 1 }).then(
        () => 'ok',
        (error) => error.code ?? error.message,
      ),
    ),
  );

  const succeeded = results.filter((r) => r === 'ok').length;
  const soldOut = results.filter((r) => r === 'SOLD_OUT').length;
  const other = results.filter((r) => r !== 'ok' && r !== 'SOLD_OUT');
  const finalTier = await repository.getTier(tier.id);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM bookings WHERE tier_id = ?').get(tier.id);

  console.log(`\n${label}`);
  console.log(`  Capacity:             ${finalTier.capacity}`);
  console.log(`  Bookings succeeded:   ${succeeded}`);
  console.log(`  SOLD_OUT:             ${soldOut}`);
  console.log(`  Other errors:         ${other.length}${other.length ? ` (${[...new Set(other)].join(', ')})` : ''}`);
  console.log(`  "sold" afterwards:    ${finalTier.sold}`);
  console.log(`  Bookings in database: ${count} for ${finalTier.capacity} seat(s)`);
  console.log(count > finalTier.capacity ? '  PROBLEM: more bookings than seats!' : '  No overselling.');
}

console.log(`${ATTENDEES} people try to book the last seat at the same moment.`);
await run('Before: the Build 4 way (read, check in JavaScript, then write)', ({ repository }) => build4Book(repository));
await run('After: the Build 5 way (one atomic UPDATE in the database)', ({ bookings }) => (userId, input) => bookings.bookTickets(userId, input));
