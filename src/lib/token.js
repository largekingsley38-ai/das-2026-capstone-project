import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from '../domain/errors.js';

// HS256 signed tokens. The secret is always passed in (it comes from an
// environment variable in the server), so nothing secret lives in this file.

const toB64 = (value) => Buffer.from(value).toString('base64url');

function checkSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('A token secret of at least 16 characters is required');
  }
}

function signature(data, secret) {
  return createHmac('sha256', secret).update(data).digest();
}

function invalid() {
  return new DomainError('UNAUTHENTICATED', 'Missing, invalid or expired token');
}

export function signToken(payload, { secret, expiresInSeconds = 3600, now = Date.now() } = {}) {
  checkSecret(secret);
  const issuedAt = Math.floor(now / 1000);
  const header = toB64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toB64(JSON.stringify({ ...payload, iat: issuedAt, exp: issuedAt + expiresInSeconds }));
  const sig = signature(`${header}.${body}`, secret).toString('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token, { secret, now = Date.now() } = {}) {
  checkSecret(secret);
  if (typeof token !== 'string') throw invalid();
  const parts = token.split('.');
  if (parts.length !== 3) throw invalid();

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  // Only HS256 is accepted. "none" or anything else is refused.
  if (!header || header.alg !== 'HS256') throw invalid();

  const expected = signature(`${parts[0]}.${parts[1]}`, secret);
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid();

  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= Math.floor(now / 1000)) {
    throw invalid();
  }
  return payload;
}