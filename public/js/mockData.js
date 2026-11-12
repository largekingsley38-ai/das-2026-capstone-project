// Fake data for Build 6. Prices are whole cents.
// Shapes follow the real API (docs/api-examples.md):
// tier = id, eventId, name, priceCents, capacity, sold

export const events = [
  {
    id: 'evt-jazz',
    title: 'Lagos Jazz Night',
    city: 'Lagos',
    venue: 'Eko Hall',
    startsAt: '2026-12-05T18:00:00.000Z',
    status: 'published',
  },
  {
    id: 'evt-comedy',
    title: 'Abuja Comedy Show',
    city: 'Abuja',
    venue: 'City Hall',
    startsAt: '2026-12-10T18:00:00.000Z',
    status: 'published',
  },
  {
    id: 'evt-food',
    title: 'Port Harcourt Food Fest',
    city: 'Port Harcourt',
    venue: 'Rivers Park',
    startsAt: '2026-12-20T12:00:00.000Z',
    status: 'published',
  },
];

export const tiers = [
  { id: 'tier-jazz-reg', eventId: 'evt-jazz', name: 'Regular', priceCents: 500000, capacity: 50, sold: 12 },
  { id: 'tier-jazz-vip', eventId: 'evt-jazz', name: 'VIP', priceCents: 1500000, capacity: 10, sold: 10 },
  { id: 'tier-comedy-reg', eventId: 'evt-comedy', name: 'Regular', priceCents: 250000, capacity: 50, sold: 3 },
  { id: 'tier-food-reg', eventId: 'evt-food', name: 'Regular', priceCents: 100000, capacity: 4, sold: 2 },
];

// How long seats are held in checkout, in seconds.
export const HOLD_SECONDS = 600;