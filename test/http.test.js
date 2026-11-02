import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRouter } from '../src/http/router.js';
import { createApp } from '../src/http/app.js';

// ---------- router ----------
test('router: a path with :id gives the value in params', () => {
  const router = createRouter();
  router.get('/api/events/:id', () => 'handler');
  const found = router.match('GET', '/api/events/42');
  assert.deepEqual(found.params, { id: '42' });
});

test('router: the wrong method does not match', () => {
  const router = createRouter();
  router.get('/api/events/:id', () => 'handler');
  assert.equal(router.match('POST', '/api/events/42'), null);
});

test('router: an unknown path does not match', () => {
  const router = createRouter();
  router.get('/health', () => 'ok');
  assert.equal(router.match('GET', '/nope'), null);
});

test('router: a path with a different number of parts does not match', () => {
  const router = createRouter();
  router.get('/api/events/:id', () => 'handler');
  assert.equal(router.match('GET', '/api/events'), null);
});

// ---------- real HTTP requests ----------
function startServer() {
  return new Promise((resolve) => {
    const server = createApp();
    server.listen(0, () => resolve(server));
  });
}

test('GET /health returns {"status":"ok"}', async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  } finally {
    server.close();
  }
});

test('an unknown /api path returns a JSON 404 in the error shape', async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/api/nothing`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.error.message, 'string');
  } finally {
    server.close();
  }
});

test('a path that tries to escape public/ is refused', async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/..%2fpackage.json`);
    assert.notEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.error);
  } finally {
    server.close();
  }
});

test('the home page is served from public/', async () => {
  const server = await startServer();
  try {
    const { port } = server.address();
    const res = await fetch(`http://localhost:${port}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Event Ticketing/);
  } finally {
    server.close();
  }
});