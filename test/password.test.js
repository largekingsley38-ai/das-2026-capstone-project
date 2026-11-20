import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from '../src/lib/password.js';

test('the right password verifies', async () => {
  const stored = await hashPassword('correct horse');
  assert.equal(await verifyPassword('correct horse', stored), true);
});

test('a wrong password does not verify', async () => {
  const stored = await hashPassword('correct horse');
  assert.equal(await verifyPassword('wrong horse', stored), false);
});

test('the stored value is not the password, and each hash has its own salt', async () => {
  const a = await hashPassword('same password');
  const b = await hashPassword('same password');
  assert.ok(!a.includes('same password'));
  assert.notEqual(a, b);
});

test('a broken stored value returns false instead of crashing', async () => {
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', undefined), false);
});