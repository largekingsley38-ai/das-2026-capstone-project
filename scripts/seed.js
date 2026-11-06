import { config } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createEventService } from '../src/services/eventService.js';

// Fills the database ONCE. Running it again does nothing.
const db = openDatabase(config.dbFile);
const repository = createSqliteRepository(db);
const events = createEventService(repository);

const existing = await repository.listEvents();
if (existing.length > 0) {
  console.log(`Database already has ${existing.length} event(s). Nothing to do.`);
} else {
  const event = await events.createEvent('seed-organizer', {
    title: 'Lagos Jazz Night',
    city: 'Lagos',
    venue: 'Eko Hall',
    startsAt: '2026-12-05T18:00:00Z',
  });
  await events.addTier('seed-organizer', event.id, { name: 'Regular', priceCents: 5000, capacity: 50 });
  await events.addTier('seed-organizer', event.id, { name: 'VIP', priceCents: 12000, capacity: 10 });
  await events.publishEvent('seed-organizer', event.id);
  console.log('Seeded 1 published event with 2 tiers.');
}