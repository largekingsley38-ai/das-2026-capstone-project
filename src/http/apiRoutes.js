import { readJsonBody } from './body.js';
import { DomainError } from '../domain/errors.js';
import { verifyToken } from '../lib/token.js';

// Routes only read the request and shape the response.
// All rules live in the services.

function bearerToken(req) {
  const header = req.headers['authorization'];
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

export function registerApiRoutes(router, { eventService, bookingService, waitlistService, authService, tokenSecret }) {
  // Who is calling? Read from the signed token, never from a plain header.
  const caller = (req) => verifyToken(bearerToken(req), { secret: tokenSecret });
  const callerId = (req) => caller(req).sub;
  function requireRole(req, role) {
    const who = caller(req);
    if (who.role !== role) throw new DomainError('FORBIDDEN', 'Only ' + role + ' accounts can do this');
    return who.sub;
  }

  router.post('/api/auth/signup', async ({ req }) => {
    const body = await readJsonBody(req);
    return { status: 201, body: await authService.signup(body) };
  });

  router.post('/api/auth/login', async ({ req }) => {
    const body = await readJsonBody(req);
    return { body: await authService.login(body) };
  });

  router.get('/api/auth/me', async ({ req }) => {
    return { body: { user: await authService.me(callerId(req)) } };
  });

  router.get('/api/bookings', async ({ req }) => {
    return { body: { bookings: await bookingService.listMine(callerId(req)) } };
  });

  router.post('/api/events', async ({ req }) => {
    const body = await readJsonBody(req);
    const event = await eventService.createEvent(requireRole(req, 'organizer'), body);
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

  router.post('/api/waitlist', async ({ req }) => {
    const body = await readJsonBody(req);
    const entry = await waitlistService.joinWaitlist(callerId(req), body);
    return { status: 201, body: { entry } };
  });

  router.get('/api/waitlist/mine', async ({ req }) => {
    const entries = await waitlistService.listMine(callerId(req));
    return { body: { entries } };
  });

  router.post('/api/waitlist/:id/accept', async ({ req, params }) => {
    const booking = await waitlistService.acceptOffer(callerId(req), params.id);
    return { status: 201, body: { booking } };
  });

  router.get('/api/bookings/:reference/refund-preview', async ({ req, params }) => {
    const preview = await bookingService.previewRefund(callerId(req), params.reference);
    return { body: { preview } };
  });

  router.post('/api/bookings/:reference/cancel', async ({ req, params }) => {
    const booking = await bookingService.cancelBooking(callerId(req), params.reference);
    return { body: { booking } };
  });
}