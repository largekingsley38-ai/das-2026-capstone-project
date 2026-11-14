// The ONLY file the pages use to get data.
// It now calls the real server. Same function names as before.

import { HOLD_SECONDS } from './mockData.js';

// Who is booking. The real server reads this header.
const USER_ID = 'buyer1';

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// One helper for every call. Errors look like { error: { code, message } }.
async function request(method, path, body) {
  const headers = { 'x-user-id': USER_ID };
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw apiError('NETWORK', 'Cannot reach the server');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw apiError(
      data?.error?.code ?? 'ERROR',
      data?.error?.message ?? `Request failed (${res.status})`,
    );
  }
  return data;
}

// options: q, city, maxPriceCents, onlyAvailable, sort (date | price | availability)
export async function listEvents(options = {}) {
  const { q = '', city = '', maxPriceCents, onlyAvailable = false, sort = 'date' } = options;
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (city) params.set('city', city);
  if (typeof maxPriceCents === 'number') params.set('maxPriceCents', String(maxPriceCents));
  if (onlyAvailable) params.set('onlyAvailable', 'true');
  params.set('sort', sort);
  return request('GET', `/api/events?${params.toString()}`);
}

// Returns { event, tiers } (each tier has seatsLeft).
export async function getEvent(id) {
  return request('GET', `/api/events/${encodeURIComponent(id)}`);
}

// The server has no hold timer, so holdExpiresAt is added here for the countdown only.
export async function createBooking(input = {}) {
  const { tierId, quantity } = input;
  const data = await request('POST', '/api/bookings', { tierId, quantity });
  const started = Date.parse(data.booking.createdAt);
  const holdExpiresAt = new Date(started + HOLD_SECONDS * 1000).toISOString();
  return { booking: { ...data.booking, holdExpiresAt } };
}

// input.decline = true makes the fake card fail.
export async function pay(reference, input = {}) {
  return request('POST', `/api/bookings/${encodeURIComponent(reference)}/pay`, {
    decline: input.decline === true,
  });
}