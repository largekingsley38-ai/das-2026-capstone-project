import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/http/app.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

// Starts the real server on a free port (port 0 = "pick any free one").
async function start() {
  const paymentGateway = createMockPaymentGateway();
  const server = createApp({ paymentGateway });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;

  async function call(method, path, { user, body } = {}) {
    const headers = {};
    if (user) headers['x-user-id'] = user;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  }

  return { call, paymentGateway, close: () => server.close() };
}

// Makes a published event with one tier. Returns the ids.
async function publishedEvent(call, capacity = 5) {
  const created = await call('POST', '/api/events', {
    user: 'org1',
    body: { title: 'Lagos Jazz Night', city: 'Lagos', venue: 'Eko Hall', startsAt: '2026-12-05T18:00:00Z' },
  });
  const eventId = created.json.event.id;
  const tier = await call('POST', `/api/events/${eventId}/tiers`, {
    user: 'org1',
    body: { name: 'Regular', priceCents: 5000, capacity },
  });
  await call('POST', `/api/events/${eventId}/publish`, { user: 'org1' });
  return { eventId, tierId: tier.json.tier.id };
}

test('S02: creating an event returns 201 and a draft', async () => {
  const { call, close } = await start();
  try {
    const res = await call('POST', '/api/events', {
      user: 'org1',
      body: { title: 'Show', city: 'Abuja', startsAt: '2026-12-05' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.event.status, 'draft');
  } finally {
    close();
  }
});

test('S02: a missing title is 400 VALIDATION in the error shape', async () => {
  const { call, close } = await start();
  try {
    const res = await call('POST', '/api/events', { user: 'org1', body: { city: 'Abuja', startsAt: '2026-12-05' } });
    assert.equal(res.status, 400);
    assert.equal(res.json.error.code, 'VALIDATION');
    assert.ok(res.json.error.message);
  } finally {
    close();
  }
});

test('a missing x-user-id header is 401', async () => {
  const { call, close } = await start();
  try {
    const res = await call('POST', '/api/events', { body: { title: 'Show', city: 'Abuja', startsAt: '2026-12-05' } });
    assert.equal(res.status, 401);
    assert.equal(res.json.error.code, 'UNAUTHENTICATED');
  } finally {
    close();
  }
});

test('bad JSON is 400 BAD_JSON (a real POST)', async () => {
  const { close, call } = await start();
  try {
    const server = createApp();
    await new Promise((resolve) => server.listen(0, resolve));
    const res = await fetch(`http://localhost:${server.address().port}/api/events`, {
      method: 'POST',
      headers: { 'x-user-id': 'org1', 'content-type': 'application/json' },
      body: '{ not json',
    });
    const json = await res.json();
    assert.equal(res.status, 400);
    assert.equal(json.error.code, 'BAD_JSON');
    server.close();
  } finally {
    close();
  }
});

test('S03: a non-whole price is 400 VALIDATION', async () => {
  const { call, close } = await start();
  try {
    const created = await call('POST', '/api/events', {
      user: 'org1',
      body: { title: 'Show', city: 'Abuja', startsAt: '2026-12-05' },
    });
    const res = await call('POST', `/api/events/${created.json.event.id}/tiers`, {
      user: 'org1',
      body: { name: 'Regular', priceCents: 10.5, capacity: 10 },
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error.code, 'VALIDATION');
  } finally {
    close();
  }
});

test('S04: publish with no tiers is 409, and unpublish hides the event', async () => {
  const { call, close } = await start();
  try {
    const created = await call('POST', '/api/events', {
      user: 'org1',
      body: { title: 'Show', city: 'Abuja', startsAt: '2026-12-05' },
    });
    const id = created.json.event.id;
    const bad = await call('POST', `/api/events/${id}/publish`, { user: 'org1' });
    assert.equal(bad.status, 409);
    assert.equal(bad.json.error.code, 'INVALID_STATE');

    const { eventId } = await publishedEvent(call);
    let list = await call('GET', '/api/events');
    assert.equal(list.json.events.length, 1);

    await call('POST', `/api/events/${eventId}/unpublish`, { user: 'org1' });
    list = await call('GET', '/api/events');
    assert.equal(list.json.events.length, 0);
  } finally {
    close();
  }
});

test('S05: search filters by city and a bad sort is 400', async () => {
  const { call, close } = await start();
  try {
    await publishedEvent(call);
    const hit = await call('GET', '/api/events?city=lagos&sort=price');
    assert.equal(hit.status, 200);
    assert.equal(hit.json.events.length, 1);

    const miss = await call('GET', '/api/events?city=Kano');
    assert.equal(miss.json.events.length, 0);

    const bad = await call('GET', '/api/events?sort=banana');
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, 'VALIDATION');
  } finally {
    close();
  }
});

test('S06: booking returns 201 pending; too many is 409 SOLD_OUT', async () => {
  const { call, close } = await start();
  try {
    const { tierId } = await publishedEvent(call, 3);
    const ok = await call('POST', '/api/bookings', { user: 'ada', body: { tierId, quantity: 2 } });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.booking.status, 'pending');
    assert.equal(ok.json.booking.amountCents, 10000);

    const tooMany = await call('POST', '/api/bookings', { user: 'bayo', body: { tierId, quantity: 2 } });
    assert.equal(tooMany.status, 409);
    assert.equal(tooMany.json.error.code, 'SOLD_OUT');
  } finally {
    close();
  }
});

test('S07: paying makes the booking paid; paying again does not charge twice', async () => {
  const { call, close, paymentGateway } = await start();
  try {
    const { tierId } = await publishedEvent(call);
    const booked = await call('POST', '/api/bookings', { user: 'ada', body: { tierId, quantity: 1 } });
    const ref = booked.json.booking.reference;

    const paid = await call('POST', `/api/bookings/${ref}/pay`, { user: 'ada', body: {} });
    assert.equal(paid.status, 200);
    assert.equal(paid.json.booking.status, 'paid');
    assert.equal(paid.json.booking.reference, ref);

    const again = await call('POST', `/api/bookings/${ref}/pay`, { user: 'ada', body: {} });
    assert.equal(again.status, 409);
    assert.equal(again.json.error.code, 'INVALID_TRANSITION');
    assert.equal(paymentGateway.chargeCount(), 1);
  } finally {
    close();
  }
});

test('S07: a declined card is PAYMENT_DECLINED and the booking stays pending, then retry works', async () => {
  const { call, close } = await start();
  try {
    const { tierId } = await publishedEvent(call);
    const booked = await call('POST', '/api/bookings', { user: 'ada', body: { tierId, quantity: 1 } });
    const ref = booked.json.booking.reference;

    const declined = await call('POST', `/api/bookings/${ref}/pay`, { user: 'ada', body: { decline: true } });
    assert.equal(declined.status, 402);
    assert.equal(declined.json.error.code, 'PAYMENT_DECLINED');

    const retry = await call('POST', `/api/bookings/${ref}/pay`, { user: 'ada', body: {} });
    assert.equal(retry.status, 200);
    assert.equal(retry.json.booking.status, 'paid');
  } finally {
    close();
  }
});

test('S07: paying a cancelled booking is INVALID_TRANSITION', async () => {
  const { call, close } = await start();
  try {
    const { tierId } = await publishedEvent(call);
    const booked = await call('POST', '/api/bookings', { user: 'ada', body: { tierId, quantity: 1 } });
    const ref = booked.json.booking.reference;
    await call('POST', `/api/bookings/${ref}/cancel`, { user: 'ada' });

    const res = await call('POST', `/api/bookings/${ref}/pay`, { user: 'ada', body: {} });
    assert.equal(res.status, 409);
    assert.equal(res.json.error.code, 'INVALID_TRANSITION');
  } finally {
    close();
  }
});

test('only the person who booked can pay (403 for anyone else)', async () => {
  const { call, close, paymentGateway } = await start();
  try {
    const { tierId } = await publishedEvent(call);
    const booked = await call('POST', '/api/bookings', { user: 'ada', body: { tierId, quantity: 1 } });
    const ref = booked.json.booking.reference;

    const res = await call('POST', `/api/bookings/${ref}/pay`, { user: 'bayo', body: {} });
    assert.equal(res.status, 403);
    assert.equal(res.json.error.code, 'FORBIDDEN');
    assert.equal(paymentGateway.chargeCount(), 0);
  } finally {
    close();
  }
});

test('cancelling an unpaid booking gives the seats back; a paid one cannot be cancelled yet', async () => {
  const { call, close } = await start();
  try {
    const { tierId } = await publishedEvent(call, 2);
    const first = await call('POST', '/api/bookings', { user: 'ada', body: { tierId, quantity: 2 } });
    const soldOut = await call('POST', '/api/bookings', { user: 'bayo', body: { tierId, quantity: 1 } });
    assert.equal(soldOut.status, 409);

    const cancelled = await call('POST', `/api/bookings/${first.json.booking.reference}/cancel`, { user: 'ada' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.json.booking.status, 'cancelled');

    const nowOk = await call('POST', '/api/bookings', { user: 'bayo', body: { tierId, quantity: 1 } });
    assert.equal(nowOk.status, 201);

    await call('POST', `/api/bookings/${nowOk.json.booking.reference}/pay`, { user: 'bayo', body: {} });
    const paidCancel = await call('POST', `/api/bookings/${nowOk.json.booking.reference}/cancel`, { user: 'bayo' });
    assert.equal(paidCancel.status, 409);
  } finally {
    close();
  }
});