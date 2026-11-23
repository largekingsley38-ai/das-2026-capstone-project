import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/http/app.js';

const SECRET = 'test-secret-at-least-16-chars';

async function start() {
  const server = createApp({ tokenSecret: SECRET });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;

  async function call(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  }

  async function signup(email, role = 'attendee') {
    const res = await call('POST', '/api/auth/signup', { body: { email, password: 'password123', role } });
    return res.json.token;
  }

  return { call, signup, close: () => server.close() };
}

async function publishedTier(call, orgToken, capacity) {
  const created = await call('POST', '/api/events', {
    token: orgToken,
    body: { title: 'Show', city: 'Lagos', venue: 'Hall', startsAt: '2030-12-05T18:00:00Z' },
  });
  const eventId = created.json.event.id;
  const tier = await call('POST', `/api/events/${eventId}/tiers`, {
    token: orgToken,
    body: { name: 'Regular', priceCents: 5000, capacity },
  });
  await call('POST', `/api/events/${eventId}/publish`, { token: orgToken });
  return tier.json.tier.id;
}

async function book(call, token, tierId) {
  const res = await call('POST', '/api/bookings', { token, body: { tierId, quantity: 1 } });
  return res.json.booking.reference;
}

test('refund preview: a paid booking far from the event shows 100%', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const tierId = await publishedTier(call, org, 5);
    const ref = await book(call, ada, tierId);
    await call('POST', `/api/bookings/${ref}/pay`, { token: ada, body: {} });

    const res = await call('GET', `/api/bookings/${ref}/refund-preview`, { token: ada });
    assert.equal(res.status, 200);
    assert.equal(res.json.preview.status, 'paid');
    assert.equal(res.json.preview.refund.percent, 100);
    assert.equal(res.json.preview.refund.refundCents, 5000);
  } finally {
    close();
  }
});

test('refund preview: an unpaid booking refunds nothing, and another attendee gets 403', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const bob = await signup('bob@example.com');
    const tierId = await publishedTier(call, org, 5);
    const ref = await book(call, ada, tierId);

    const own = await call('GET', `/api/bookings/${ref}/refund-preview`, { token: ada });
    assert.equal(own.status, 200);
    assert.equal(own.json.preview.refund.refundCents, 0);

    const other = await call('GET', `/api/bookings/${ref}/refund-preview`, { token: bob });
    assert.equal(other.status, 403);

    const none = await call('GET', `/api/bookings/${ref}/refund-preview`);
    assert.equal(none.status, 401);
  } finally {
    close();
  }
});

test('waitlist: joining a sold-out tier works and the entry shows in my list', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const bob = await signup('bob@example.com');
    const tierId = await publishedTier(call, org, 1);
    await book(call, ada, tierId);

    const join = await call('POST', '/api/waitlist', { token: bob, body: { tierId, quantity: 1 } });
    assert.equal(join.status, 201);

    const mine = await call('GET', '/api/waitlist/mine', { token: bob });
    assert.equal(mine.status, 200);
    assert.equal(mine.json.entries.length, 1);

    const adaList = await call('GET', '/api/waitlist/mine', { token: ada });
    assert.equal(adaList.json.entries.length, 0);
  } finally {
    close();
  }
});

test('waitlist: NOT_SOLD_OUT, ALREADY_ON_WAITLIST and no token', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const bob = await signup('bob@example.com');

    const roomy = await publishedTier(call, org, 5);
    const notSoldOut = await call('POST', '/api/waitlist', { token: bob, body: { tierId: roomy, quantity: 1 } });
    assert.equal(notSoldOut.status, 409);
    assert.equal(notSoldOut.json.error.code, 'NOT_SOLD_OUT');

    const full = await publishedTier(call, org, 1);
    await book(call, ada, full);
    await call('POST', '/api/waitlist', { token: bob, body: { tierId: full, quantity: 1 } });
    const twice = await call('POST', '/api/waitlist', { token: bob, body: { tierId: full, quantity: 1 } });
    assert.equal(twice.status, 409);
    assert.equal(twice.json.error.code, 'ALREADY_ON_WAITLIST');

    const anon = await call('POST', '/api/waitlist', { body: { tierId: full, quantity: 1 } });
    assert.equal(anon.status, 401);
  } finally {
    close();
  }
});

test('waitlist: another attendee cannot accept my entry', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const bob = await signup('bob@example.com');
    const cy = await signup('cy@example.com');
    const tierId = await publishedTier(call, org, 1);
    await book(call, ada, tierId);
    const join = await call('POST', '/api/waitlist', { token: bob, body: { tierId, quantity: 1 } });
    const entryId = join.json.entry.id;

    const res = await call('POST', `/api/waitlist/${entryId}/accept`, { token: cy });
    assert.equal(res.status, 403);
    assert.equal(res.json.error.code, 'FORBIDDEN');
  } finally {
    close();
  }
});
