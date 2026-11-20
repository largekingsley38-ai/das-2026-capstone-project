// The ONLY file the pages use to get data. It calls the real server.
// Same function names as before, plus login and organizer calls.

import { HOLD_SECONDS } from './mockData.js';
import { getSession, setSession, clearSession } from './session.js';

function apiError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// One helper for every call. Errors look like { error: { code, message } }.
async function request(method, path, body) {
  const headers = {};
  const session = getSession();
  if (session) headers.authorization = 'Bearer ' + session.token;
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
    const code = data?.error?.code ?? 'ERROR';
    // A bad or expired token: forget it, so the page shows "Log in".
    if (code === 'UNAUTHENTICATED' && session) clearSession();
    throw apiError(code, data?.error?.message ?? `Request failed (${res.status})`);
  }
  return data;
}

// The server has no hold timer, so holdExpiresAt is added here for the countdown only.
function withHold(booking) {
  const started = Date.parse(booking.createdAt);
  return { ...booking, holdExpiresAt: new Date(started + HOLD_SECONDS * 1000).toISOString() };
}

// ---- Login ----

export async function signup(input = {}) {
  const data = await request('POST', '/api/auth/signup', input);
  setSession({ token: data.token, user: data.user });
  return data;
}

export async function login(input = {}) {
  const data = await request('POST', '/api/auth/login', input);
  setSession({ token: data.token, user: data.user });
  return data;
}

// ---- Events ----

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

export async function createEvent(input = {}) {
  return request('POST', '/api/events', input);
}

export async function addTier(eventId, input = {}) {
  return request('POST', `/api/events/${encodeURIComponent(eventId)}/tiers`, input);
}

export async function setPublished(eventId, published) {
  const action = published ? 'publish' : 'unpublish';
  return request('POST', `/api/events/${encodeURIComponent(eventId)}/${action}`);
}

// ---- Bookings ----

export async function createBooking(input = {}) {
  const data = await request('POST', '/api/bookings', {
    tierId: input.tierId,
    quantity: input.quantity,
  });
  return { booking: withHold(data.booking) };
}

export async function getMyBookings() {
  return request('GET', '/api/bookings');
}

// input.decline = true makes the fake card fail.
export async function pay(reference, input = {}) {
  return request('POST', `/api/bookings/${encodeURIComponent(reference)}/pay`, {
    decline: input.decline === true,
  });
}

export async function previewRefund(reference) {
  const data = await request('GET', `/api/bookings/${encodeURIComponent(reference)}/refund-preview`);
  return data.preview;
}

export async function cancelBooking(reference) {
  return request('POST', `/api/bookings/${encodeURIComponent(reference)}/cancel`);
}

// ---- Waitlist ----

export async function joinWaitlist(input = {}) {
  return request('POST', '/api/waitlist', { tierId: input.tierId, quantity: input.quantity });
}

export async function getMyWaitlist() {
  return request('GET', '/api/waitlist/mine');
}

// The accepted offer becomes a pending booking.
export async function acceptOffer(entryId) {
  const data = await request('POST', `/api/waitlist/${encodeURIComponent(entryId)}/accept`);
  return { booking: withHold(data.booking) };
}