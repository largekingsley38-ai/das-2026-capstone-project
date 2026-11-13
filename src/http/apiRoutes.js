import { readJsonBody } from './body.js';

// Routes only read the request and shape the response.
// All rules live in the services.

function callerId(req) {
  return req.headers['x-user-id'];
}

export function registerApiRoutes(router, { eventService, bookingService }) {
  router.post('/api/events', async ({ req }) => {
    const body = await readJsonBody(req);
    const event = await eventService.createEvent(callerId(req), body);
    return { status: 201, body: { event } };
  });

  router.post('/api/events/:id/tiers', async ({ req, params }) => {
    const body = await readJsonBody(req);
    const tier = await eventService.addTier(callerId(req), params.id, body);
    return { status: 201, body: { tier } };
  });

  router.post('/api/events/:id/publish', async ({ req, params }) => {
    const event = await eventService.publishEvent(callerId(req), params.id);
    return { body: { event } };
  });

  router.post('/api/events/:id/unpublish', async ({ req, params }) => {
    const event = await eventService.unpublishEvent(callerId(req), params.id);
    return { body: { event } };
  });

  router.get('/api/events/:id', async ({ params }) => {
    const { event, tiers } = await eventService.getPublishedEvent(params.id);
    return { body: { event, tiers } };
  });

  router.get('/api/events', async ({ url }) => {
    const query = Object.fromEntries(url.searchParams);
    const events = await eventService.searchPublishedEvents(query);
    return { body: { events } };
  });

  router.post('/api/bookings', async ({ req }) => {
    const body = await readJsonBody(req);
    const booking = await bookingService.bookTickets(callerId(req), body);
    return { status: 201, body: { booking } };
  });

  router.post('/api/bookings/:reference/pay', async ({ req, params }) => {
    const body = await readJsonBody(req);
    const booking = await bookingService.payBooking(callerId(req), params.reference, body);
    return { body: { booking } };
  });

  router.post('/api/bookings/:reference/cancel', async ({ req, params }) => {
    const booking = await bookingService.cancelBooking(callerId(req), params.reference);
    return { body: { booking } };
  });
}