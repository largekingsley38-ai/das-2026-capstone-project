// The API description in OpenAPI 3.1 format, served at GET /openapi.json.
// public/docs.html turns it into the readable docs at /docs.html.
// When you add or change a route in apiRoutes.js, change it here too.

const json = (schema) => ({ content: { 'application/json': { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const wrap = (key, schema) => ({ type: 'object', properties: { [key]: schema } });
const errorResponse = (description, codes) => ({
  description: `${description} Possible codes: ${codes.map((code) => `\`${code}\``).join(', ')}.`,
  ...json(ref('Error')),
});

const loggedIn = [{ BearerToken: [] }];
const anyone = [];
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const referenceParam = { name: 'reference', in: 'path', required: true, description: 'Booking reference, for example `A4WMMBBT`', schema: { type: 'string' } };

const errors = {
  validation: errorResponse('The input is missing or wrong.', ['VALIDATION', 'BAD_JSON']),
  unauthenticated: errorResponse('No token, or a bad or expired token.', ['UNAUTHENTICATED']),
  forbidden: errorResponse('Your role or ownership does not allow this.', ['FORBIDDEN']),
  notFound: errorResponse('It does not exist.', ['NOT_FOUND']),
};

const op = (tag, summary, operationId, extra) => ({ tags: [tag], summary, operationId, security: loggedIn, ...extra });

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Event Ticketing API',
    version: '0.8.0',
    description: [
      'Events, ticket tiers, bookings, mock payment, refunds, waitlist and login. Data is stored in SQLite.',
      '',
      '**Who you are.** Sign up or log in to get a signed token, then send `Authorization: Bearer <token>`. There are three roles: attendee, organizer and staff. Only organizers can create events.',
      '',
      '**Money** is a whole number of the smallest unit (kobo): `500000` is 5,000.00.',
      '',
      '**Errors** always look like `{ "error": { "code": "SOLD_OUT", "message": "..." } }`.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [{ name: 'Auth' }, { name: 'Events' }, { name: 'Bookings' }, { name: 'Waitlist' }, { name: 'System' }],
  paths: {
    '/health': {
      get: { tags: ['System'], summary: 'Health check', operationId: 'health', security: anyone, responses: { 200: { description: 'The server is up.', ...json({ type: 'object', properties: { status: { const: 'ok' } } }) } } },
    },
    '/api/auth/signup': {
      post: op('Auth', 'Create an account', 'signup', {
        security: anyone,
        description: 'Makes an attendee (or the role given). The password is stored hashed and never returned.',
        requestBody: { required: true, ...json(ref('Credentials')) },
        responses: { 201: { description: 'A token and the user.', ...json(ref('AuthResult')) }, 400: errors.validation, 409: errorResponse('The email is already used.', ['EMAIL_TAKEN']) },
      }),
    },
    '/api/auth/login': {
      post: op('Auth', 'Log in', 'login', {
        security: anyone,
        requestBody: { required: true, ...json(ref('Credentials')) },
        responses: { 200: { description: 'A token and the user.', ...json(ref('AuthResult')) }, 401: errorResponse('Wrong email or password (same answer for both).', ['INVALID_CREDENTIALS']) },
      }),
    },
    '/api/auth/me': {
      get: op('Auth', 'Who am I', 'me', { responses: { 200: { description: 'The logged-in user.', ...json(wrap('user', ref('User'))) }, 401: errors.unauthenticated } }),
    },
    '/api/events': {
      post: op('Events', 'Create an event (organizer only)', 'createEvent', {
        description: 'Creates a draft owned by the caller. (S02)',
        requestBody: { required: true, ...json(ref('NewEvent')) },
        responses: { 201: { description: 'The new draft.', ...json(wrap('event', ref('EventSummary'))) }, 400: errors.validation, 401: errors.unauthenticated, 403: errors.forbidden },
      }),
      get: {
        tags: ['Events'], summary: 'Search published events', operationId: 'searchEvents', security: anyone,
        description: 'Search, filter and sort published events. Every parameter is optional. (S05)',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'city', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'maxPriceCents', in: 'query', schema: { type: 'integer', minimum: 0 } },
          { name: 'onlyAvailable', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['date', 'price', 'availability'], default: 'date' } },
        ],
        responses: { 200: { description: 'Matching events.', ...json(wrap('events', { type: 'array', items: ref('EventSummary') })) }, 400: errors.validation },
      },
    },
    '/api/events/{id}': {
      get: {
        tags: ['Events'], summary: 'View a published event', operationId: 'getEvent', security: anyone, parameters: [idParam],
        description: 'Published events only, with each tier and its seats left. A draft gives NOT_FOUND.',
        responses: { 200: { description: 'The event and its tiers.', ...json({ type: 'object', properties: { event: ref('EventSummary'), tiers: { type: 'array', items: ref('Tier') } } }) }, 404: errors.notFound },
      },
    },
    '/api/events/{id}/tiers': {
      post: op('Events', 'Add a ticket tier (event owner only)', 'addTier', {
        parameters: [idParam],
        requestBody: { required: true, ...json(ref('NewTier')) },
        responses: { 201: { description: 'The new tier.', ...json(wrap('tier', ref('Tier'))) }, 400: errors.validation, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound },
      }),
    },
    '/api/events/{id}/publish': {
      post: op('Events', 'Publish an event (owner only)', 'publishEvent', {
        parameters: [idParam],
        responses: { 200: { description: 'The published event.', ...json(wrap('event', ref('EventSummary'))) }, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound, 409: errorResponse('The event has no tiers.', ['INVALID_STATE']) },
      }),
    },
    '/api/events/{id}/unpublish': {
      post: op('Events', 'Unpublish an event (owner only)', 'unpublishEvent', {
        parameters: [idParam],
        responses: { 200: { description: 'The event, now a draft.', ...json(wrap('event', ref('EventSummary'))) }, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound },
      }),
    },
    '/api/bookings': {
      get: op('Bookings', 'My bookings', 'listMyBookings', { description: 'Only your own bookings.', responses: { 200: { description: 'Your bookings.', ...json(wrap('bookings', { type: 'array', items: ref('Booking') })) }, 401: errors.unauthenticated } }),
      post: op('Bookings', 'Book tickets', 'book', {
        description: 'Holds seats. The booking starts as pending and expires if not paid in time. (S06)',
        requestBody: { required: true, ...json(ref('NewBooking')) },
        responses: { 201: { description: 'The pending booking.', ...json(wrap('booking', ref('Booking'))) }, 400: errors.validation, 401: errors.unauthenticated, 404: errors.notFound, 409: errorResponse('Not enough seats, or the event is not on sale.', ['SOLD_OUT', 'INVALID_STATE']) },
      }),
    },
    '/api/bookings/{reference}': {
      get: op('Bookings', 'View one of my bookings', 'getMyBooking', {
        description: 'Only the person who made the booking can read it. Anyone else gets FORBIDDEN.',
        parameters: [referenceParam],
        responses: { 200: { description: 'The booking.', ...json(wrap('booking', ref('Booking'))) }, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound },
      }),
    },
    '/api/bookings/{reference}/pay': {
      post: op('Bookings', 'Pay for a booking (mock card)', 'pay', {
        description: 'Send `{ "decline": true }` to simulate a declined card: you get 402 and the booking stays pending. Send `{}` to pay. Paying twice never charges twice. (S07)',
        parameters: [referenceParam],
        requestBody: { required: true, ...json({ type: 'object', properties: { decline: { type: 'boolean', description: 'true simulates a declined card.' } } }) },
        responses: { 200: { description: 'The paid booking.', ...json(wrap('booking', ref('Booking'))) }, 400: errors.validation, 401: errors.unauthenticated, 402: errorResponse('The mock card was declined.', ['PAYMENT_DECLINED']), 403: errors.forbidden, 404: errors.notFound, 409: errorResponse('Already paid, cancelled, or the hold expired.', ['INVALID_TRANSITION', 'BOOKING_EXPIRED']) },
      }),
    },
    '/api/bookings/{reference}/refund-preview': {
      get: op('Bookings', 'Show the refund before cancelling', 'refundPreview', {
        description: '100% refund 7 or more days before the event, 50% from 2 days up to 7 days, 0% under 2 days.',
        parameters: [referenceParam],
        responses: { 200: { description: 'What a cancel would refund.', ...json(wrap('preview', { type: 'object' })) }, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound },
      }),
    },
    '/api/bookings/{reference}/cancel': {
      post: op('Bookings', 'Cancel a booking', 'cancel', {
        description: 'A pending booking gives its seats back. A paid booking is refunded by the refund rule. After the event has started it is refused.',
        parameters: [referenceParam],
        responses: { 200: { description: 'The booking after cancelling.', ...json(wrap('booking', ref('Booking'))) }, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound, 409: errorResponse('Already cancelled, or the event has started.', ['INVALID_TRANSITION', 'EVENT_STARTED']) },
      }),
    },
    '/api/waitlist': {
      post: op('Waitlist', 'Join the waitlist of a sold-out tier', 'joinWaitlist', {
        requestBody: { required: true, ...json({ type: 'object', required: ['tierId', 'quantity'], properties: { tierId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10 } } }) },
        responses: { 201: { description: 'Your place in the line.', ...json(wrap('entry', { type: 'object' })) }, 400: errors.validation, 401: errors.unauthenticated, 409: errorResponse('The tier still has seats, or you are already in line.', ['NOT_SOLD_OUT', 'ALREADY_ON_WAITLIST']) },
      }),
    },
    '/api/waitlist/mine': {
      get: op('Waitlist', 'My waitlist entries', 'myWaitlist', { responses: { 200: { description: 'Your entries.', ...json(wrap('entries', { type: 'array', items: { type: 'object' } })) }, 401: errors.unauthenticated } }),
    },
    '/api/waitlist/{id}/accept': {
      post: op('Waitlist', 'Accept a seat offer', 'acceptOffer', {
        parameters: [idParam],
        responses: { 201: { description: 'A pending booking for the offered seats.', ...json(wrap('booking', ref('Booking'))) }, 401: errors.unauthenticated, 403: errors.forbidden, 404: errors.notFound, 409: errorResponse('The offer has expired, or there is no open offer.', ['OFFER_EXPIRED', 'INVALID_STATE']) },
      }),
    },
  },
  components: {
    securitySchemes: { BearerToken: { type: 'http', scheme: 'bearer', description: 'The token from signup or login.' } },
    schemas: {
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string', example: 'SOLD_OUT' }, message: { type: 'string' } } } } },
      Credentials: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'att2@gmail.com' }, password: { type: 'string', minLength: 8 }, role: { type: 'string', enum: ['attendee', 'organizer', 'staff'] } } },
      User: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['attendee', 'organizer', 'staff'] } } },
      AuthResult: { type: 'object', properties: { token: { type: 'string' }, user: ref('User') } },
      NewEvent: { type: 'object', required: ['title', 'city', 'startsAt'], properties: { title: { type: 'string', example: 'Fit night' }, city: { type: 'string', example: 'Lagos' }, venue: { type: 'string' }, startsAt: { type: 'string', format: 'date-time', example: '2027-12-05T17:00:00Z' } } },
      EventSummary: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, city: { type: 'string' }, venue: { type: 'string' }, startsAt: { type: 'string', format: 'date-time' }, status: { type: 'string', enum: ['draft', 'published'] } } },
      NewTier: { type: 'object', required: ['name', 'priceCents', 'capacity'], properties: { name: { type: 'string', example: 'Regular' }, priceCents: { type: 'integer', minimum: 0, example: 500000 }, capacity: { type: 'integer', minimum: 1, example: 100 } } },
      Tier: { type: 'object', properties: { id: { type: 'string' }, eventId: { type: 'string' }, name: { type: 'string' }, priceCents: { type: 'integer' }, capacity: { type: 'integer' }, sold: { type: 'integer' }, seatsLeft: { type: 'integer' } } },
      NewBooking: { type: 'object', required: ['tierId', 'quantity'], properties: { tierId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10 } } },
      Booking: { type: 'object', properties: { reference: { type: 'string', example: 'A4WMMBBT' }, tierId: { type: 'string' }, quantity: { type: 'integer' }, amountCents: { type: 'integer' }, status: { type: 'string', enum: ['pending', 'paid', 'cancelled', 'refunded', 'checked_in'] }, createdAt: { type: 'string', format: 'date-time' } } },
    },
  },
};
