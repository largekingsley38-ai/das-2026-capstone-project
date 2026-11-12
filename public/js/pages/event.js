// Event page: show tiers, pick a quantity, check out with a countdown.
// Data comes only from api.js. No fetch here.

import { getEvent, createBooking, pay } from '../api.js';
import { el, clear, formatPrice } from '../ui.js';

const MAX_PER_BOOKING = 10;

const statusLine = document.getElementById('status');
const infoBox = document.getElementById('event-info');
const tiersBox = document.getElementById('tiers');
const checkoutBox = document.getElementById('checkout');
const checkoutSummary = document.getElementById('checkout-summary');
const countdownEl = document.getElementById('countdown');
const messageBox = document.getElementById('checkout-message');
const cardInput = document.getElementById('card-number');
const declineBox = document.getElementById('card-decline');
const payButton = document.getElementById('pay-button');

const eventId = new URLSearchParams(location.search).get('id');

let currentBooking = null;
let timerId = null;

function showMessage(kind, text) {
  clear(messageBox);
  if (text) messageBox.append(el('p', { className: `message ${kind}`, text }));
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function stopTimer() {
  if (timerId !== null) clearInterval(timerId);
  timerId = null;
}

function startCountdown(expiresAtIso) {
  stopTimer();
  const expiresAt = Date.parse(expiresAtIso);

  function tick() {
    const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    countdownEl.textContent = formatClock(left);
    if (left === 0) {
      stopTimer();
      payButton.disabled = true;
      showMessage('error', 'Your hold ran out. Please choose your tickets again.');
    }
  }

  tick();
  timerId = setInterval(tick, 1000);
}

function tierRow(tier) {
  const soldOut = tier.seatsLeft === 0;
  const max = Math.min(MAX_PER_BOOKING, tier.seatsLeft);
  const qtyId = `qty-${tier.id}`;

  const children = [
    el('h3', { text: tier.name }),
    el('p', {}, [
      el('span', { className: 'price', text: formatPrice(tier.priceCents) }),
      ' ',
      soldOut
        ? el('span', { className: 'badge sold-out', text: 'Sold out' })
        : el('span', { className: tier.seatsLeft <= 5 ? 'badge low' : 'muted', text: `${tier.seatsLeft} seats left` }),
    ]),
  ];

  if (soldOut) {
    children.push(el('button', { type: 'button', disabled: true, text: 'Sold out' }));
  } else {
    const input = el('input', { id: qtyId, type: 'number', min: 1, max, value: 1, inputmode: 'numeric' });
    const button = el('button', {
      type: 'button',
      text: 'Book tickets',
      onClick: () => book(tier, input, button),
    });
    children.push(
      el('div', { className: 'row' }, [
        el('div', { className: 'field' }, [el('label', { for: qtyId, text: `Quantity (1 to ${max})` }), input]),
        button,
      ]),
    );
  }

  return el('div', { className: soldOut ? 'card tier sold-out' : 'card tier' }, children);
}

async function book(tier, input, button) {
  const quantity = Number(input.value);
  const max = Math.min(MAX_PER_BOOKING, tier.seatsLeft);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
    showMessage('error', `Please choose between 1 and ${max} tickets.`);
    checkoutBox.hidden = false;
    payButton.disabled = true;
    return;
  }

  button.disabled = true;
  try {
    const { booking } = await createBooking({ tierId: tier.id, quantity });
    currentBooking = booking;
    checkoutSummary.textContent = `${quantity} x ${tier.name} = ${formatPrice(booking.amountCents)} (reference ${booking.reference})`;
    checkoutBox.hidden = false;
    payButton.disabled = false;
    showMessage('', '');
    startCountdown(booking.holdExpiresAt);
    checkoutBox.scrollIntoView({ behavior: 'smooth' });
    await load();
  } catch (error) {
    checkoutBox.hidden = false;
    payButton.disabled = true;
    showMessage('error', error.message);
    await load();
  } finally {
    button.disabled = false;
  }
}

async function handlePay() {
  if (!currentBooking) return;
  payButton.disabled = true;
  showMessage('', '');
  try {
    const { booking } = await pay(currentBooking.reference, { decline: declineBox.checked });
    stopTimer();
    currentBooking = booking;
    countdownEl.textContent = 'Paid';
    showMessage('success', `Payment done! Your booking ${booking.reference} is confirmed.`);
    cardInput.disabled = true;
    declineBox.disabled = true;
    await load();
  } catch (error) {
    showMessage('error', error.message);
    // A declined card keeps the booking pending, so the user can try again.
    if (error.code === 'PAYMENT_DECLINED') payButton.disabled = false;
  }
}

async function load() {
  if (!eventId) {
    statusLine.textContent = 'No event chosen. Go back to all events.';
    return;
  }
  try {
    const { event, tiers } = await getEvent(eventId);
    statusLine.textContent = '';
    document.title = `${event.title} | Event Ticketing`;

    clear(infoBox);
    infoBox.append(
      el('h2', { text: event.title }),
      el('p', { className: 'muted', text: `${event.city} · ${event.venue}` }),
      el('p', { text: formatDate(event.startsAt) }),
    );

    clear(tiersBox);
    for (const tier of tiers) tiersBox.append(tierRow(tier));
  } catch (error) {
    statusLine.textContent = `Something went wrong: ${error.message}`;
  }
}

payButton.addEventListener('click', handlePay);
await load();