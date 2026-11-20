import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/http/app.js';
import { signToken } from '../src/lib/token.js';

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

async function publishedEvent(call, orgToken) {
  const created = await call('POST', '/api/events', {
    token: orgToken,
    body: { title: 'Show', city: 'Lagos', venue: 'Hall', startsAt: '2030-12-05T18:00:00Z' },
  });
  const eventId = created.json.event.id;
  const tier = await call('POST', `/api/events/${eventId}/tiers`, {
    token: orgToken,
    body: { name: 'Regular', priceCents: 5000, capacity: 5 },
  });
  await call('POST', `/api/events/${eventId}/publish`, { token: orgToken });
  return { eventId, tierId: tier.json.tier.id };
}

test('signup makes an attendee, returns a token and never returns a password', async () => {
  const { call, close } = await start();
  try {
    const res = await call('POST', '/api/auth/signup', { body: { email: 'Ada@Example.com', password: 'password123' } });
    assert.equal(res.status, 201);
    assert.equal(res.json.user.role, 'attendee');
    assert.equal(res.json.user.email, 'ada@example.com');
    assert.ok(res.json.token);
    assert.ok(!JSON.stringify(res.json).toLowerCase().includes('password'));
  } finally {
    close();
  }
});

test('signing up with a used email gives EMAIL_TAKEN', async () => {
  const { call, signup, close } = await start();
  try {
    await signup('ada@example.com');
    const res = await call('POST', '/api/auth/signup', { body: { email: 'ADA@example.com', password: 'password123' } });
    assert.equal(res.status, 409);
    assert.equal(res.json.error.code, 'EMAIL_TAKEN');
  } finally {
    close();
  }
});

test('a password shorter than 8 characters is rejected', async () => {
  const { call, close } = await start();
  try {
    const res = await call('POST', '/api/auth/signup', { body: { email: 'ada@example.com', password: 'short' } });
    assert.equal(res.status, 400);
    assert.equal(res.json.error.code, 'VALIDATION');
  } finally {
    close();
  }
});

test('login with the right password returns a token', async () => {
  const { call, signup, close } = await start();
  try {
    await signup('ada@example.com');
    const res = await call('POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'password123' } });
    assert.equal(res.status, 200);
    assert.ok(res.json.token);
  } finally {
    close();
  }
});

test('wrong password and unknown email give the same INVALID_CREDENTIALS answer', async () => {
  const { call, signup, close } = await start();
  try {
    await signup('ada@example.com');
    const wrong = await call('POST', '/api/auth/login', { body: { email: 'ada@example.com', password: 'nope-nope-1' } });
    const unknown = await call('POST', '/api/auth/login', { body: { email: 'who@example.com', password: 'password123' } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.json.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrong.json.error.message, unknown.json.error.message);
  } finally {
    close();
  }
});

test('me works with a good token and gives 401 without one', async () => {
  const { call, signup, close } = await start();
  try {
    const token = await signup('ada@example.com');
    const ok = await call('GET', '/api/auth/me', { token });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.user.email, 'ada@example.com');
    const none = await call('GET', '/api/auth/me');
    assert.equal(none.status, 401);
    const garbage = await call('GET', '/api/auth/me', { token: 'abc.def.ghi' });
    assert.equal(garbage.status, 401);
  } finally {
    close();
  }
});

test('an edited, foreign or expired token gives UNAUTHENTICATED', async () => {
  const { call, signup, close } = await start();
  try {
    const good = await signup('ada@example.com');
    const [h, , s] = good.split('.');
    const body = Buffer.from(JSON.stringify({ sub: 'x', role: 'staff', exp: 9999999999 })).toString('base64url');
    const edited = await call('GET', '/api/auth/me', { token: `${h}.${body}.${s}` });
    assert.equal(edited.json.error.code, 'UNAUTHENTICATED');

    const foreign = signToken({ sub: 'x', role: 'organizer' }, { secret: 'a-totally-different-secret' });
    assert.equal((await call('GET', '/api/auth/me', { token: foreign })).status, 401);

    const expired = signToken(
      { sub: 'x', role: 'organizer' },
      { secret: SECRET, now: Date.now() - 2 * 3600 * 1000, expiresInSeconds: 60 },
    );
    assert.equal((await call('GET', '/api/auth/me', { token: expired })).status, 401);
  } finally {
    close();
  }
});

test('an attendee cannot create an event (FORBIDDEN)', async () => {
  const { call, signup, close } = await start();
  try {
    const token = await signup('ada@example.com');
    const res = await call('POST', '/api/events', {
      token,
      body: { title: 'Show', city: 'Lagos', startsAt: '2030-12-05T18:00:00Z' },
    });
    assert.equal(res.status, 403);
    assert.equal(res.json.error.code, 'FORBIDDEN');
  } finally {
    close();
  }
});

test('one organizer cannot edit another organizer\'s event', async () => {
  const { call, signup, close } = await start();
  try {
    const orgA = await signup('a@example.com', 'organizer');
    const orgB = await signup('b@example.com', 'organizer');
    const { eventId } = await publishedEvent(call, orgA);
    const tier = await call('POST', `/api/events/${eventId}/tiers`, {
      token: orgB,
      body: { name: 'VIP', priceCents: 9000, capacity: 2 },
    });
    assert.equal(tier.status, 403);
    const unpublish = await call('POST', `/api/events/${eventId}/unpublish`, { token: orgB });
    assert.equal(unpublish.status, 403);
  } finally {
    close();
  }
});

test('an attendee cannot pay for or cancel another attendee\'s booking', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const bob = await signup('bob@example.com');
    const { tierId } = await publishedEvent(call, org);
    const booked = await call('POST', '/api/bookings', { token: ada, body: { tierId, quantity: 1 } });
    const ref = booked.json.booking.reference;

    const pay = await call('POST', `/api/bookings/${ref}/pay`, { token: bob, body: {} });
    assert.equal(pay.status, 403);
    const cancel = await call('POST', `/api/bookings/${ref}/cancel`, { token: bob });
    assert.equal(cancel.status, 403);
  } finally {
    close();
  }
});

test('the booking list only has your own bookings', async () => {
  const { call, signup, close } = await start();
  try {
    const org = await signup('org@example.com', 'organizer');
    const ada = await signup('ada@example.com');
    const bob = await signup('bob@example.com');
    const { tierId } = await publishedEvent(call, org);
    await call('POST', '/api/bookings', { token: ada, body: { tierId, quantity: 2 } });

    const mine = await call('GET', '/api/bookings', { token: ada });
    assert.equal(mine.json.bookings.length, 1);
    const theirs = await call('GET', '/api/bookings', { token: bob });
    assert.equal(theirs.json.bookings.length, 0);
  } finally {
    close();
  }
});