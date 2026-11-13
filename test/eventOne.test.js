import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/http/app.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';

async function start() {
  const server = createApp({ paymentGateway: createMockPaymentGateway() });
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

  return { call, close: () => server.close() };
}

async function makeEvent(call, publish) {
  const created = await call('POST', '/api/events', {
    user: 'org1',
    body: { title: 'Lagos Jazz Night', city: 'Lagos', venue: 'Eko Hall', startsAt: '2026-12-05T18:00:00Z' },
  });
  const eventId = created.json.event.id;
  await call('POST', `/api/events/${eventId}/tiers`, {
    user: 'org1',
    body: { name: 'Regular', priceCents: 5000, capacity: 5 },
  });
  if (publish) await call('POST', `/api/events/${eventId}/publish`, { user: 'org1' });
  return eventId;
}

test('GET one event returns the event and its tiers with seatsLeft', async () => {
  const { call, close } = await start();
  try {
    const eventId = await makeEvent(call, true);
    const res = await call('GET', `/api/events/${eventId}`);
    assert.equal(res.status, 200);
    assert.equal(res.json.event.id, eventId);
    assert.equal(res.json.tiers.length, 1);
    assert.equal(res.json.tiers[0].seatsLeft, 5);
  } finally {
    close();
  }
});

test('GET one event with an unknown id gives 404', async () => {
  const { call, close } = await start();
  try {
    const res = await call('GET', '/api/events/nope');
    assert.equal(res.status, 404);
  } finally {
    close();
  }
});

test('GET one event that is still a draft gives 404', async () => {
  const { call, close } = await start();
  try {
    const eventId = await makeEvent(call, false);
    const res = await call('GET', `/api/events/${eventId}`);
    assert.equal(res.status, 404);
  } finally {
    close();
  }
});