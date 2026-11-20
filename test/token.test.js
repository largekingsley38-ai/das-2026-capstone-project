import test from 'node:test';
import assert from 'node:assert/strict';

import { signToken, verifyToken } from '../src/lib/token.js';

const SECRET = 'test-secret-at-least-16-chars';
const NOW = Date.parse('2026-12-01T10:00:00Z');

function make(payload = { sub: 'u1', role: 'attendee' }) {
  return signToken(payload, { secret: SECRET, now: NOW, expiresInSeconds: 60 });
}

test('a good token verifies and returns the payload', () => {
  const payload = verifyToken(make(), { secret: SECRET, now: NOW + 1000 });
  assert.equal(payload.sub, 'u1');
  assert.equal(payload.role, 'attendee');
});

test('an edited payload is rejected', () => {
  const [h, , s] = make().split('.');
  const body = Buffer.from(JSON.stringify({ sub: 'u1', role: 'staff', exp: 9999999999 })).toString('base64url');
  assert.throws(() => verifyToken(`${h}.${body}.${s}`, { secret: SECRET, now: NOW }), {
    code: 'UNAUTHENTICATED',
  });
});

test('a token signed with another secret is rejected', () => {
  const other = signToken({ sub: 'u1' }, { secret: 'a-totally-different-secret', now: NOW });
  assert.throws(() => verifyToken(other, { secret: SECRET, now: NOW }), { code: 'UNAUTHENTICATED' });
});

test('an expired token is rejected', () => {
  assert.throws(() => verifyToken(make(), { secret: SECRET, now: NOW + 61 * 1000 }), {
    code: 'UNAUTHENTICATED',
  });
});

test('alg none is rejected', () => {
  const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify({ sub: 'u1', exp: 9999999999 })).toString('base64url');
  assert.throws(() => verifyToken(`${h}.${b}.`, { secret: SECRET, now: NOW }), { code: 'UNAUTHENTICATED' });
});

test('garbage and missing tokens are rejected', () => {
  assert.throws(() => verifyToken('abc', { secret: SECRET }), { code: 'UNAUTHENTICATED' });
  assert.throws(() => verifyToken(undefined, { secret: SECRET }), { code: 'UNAUTHENTICATED' });
});