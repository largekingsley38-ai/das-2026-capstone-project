// Home page: browse, search, filter and sort events.
// Data comes only from api.js. No fetch here.

import { listEvents } from '../api.js';
import { el, clear, formatPrice } from '../ui.js';

const searchInput = document.getElementById('search');
const citySelect = document.getElementById('city');
const maxPriceInput = document.getElementById('max-price');
const sortSelect = document.getElementById('sort');
const statusLine = document.getElementById('status');
const list = document.getElementById('events');

function readOptions() {
  const options = {
    q: searchInput.value,
    city: citySelect.value,
    sort: sortSelect.value,
  };
  const naira = maxPriceInput.value.trim();
  if (naira !== '' && Number.isFinite(Number(naira)) && Number(naira) >= 0) {
    // The screen uses naira, the data uses whole cents.
    options.maxPriceCents = Math.round(Number(naira) * 100);
  }
  return options;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function eventCard(event) {
  const soldOut = event.seatsLeft === 0;
  const price = event.cheapestPriceCents === null ? 'No tickets yet' : `From ${formatPrice(event.cheapestPriceCents)}`;

  return el('li', { className: 'card' }, [
    el('h3', {}, [el('a', { href: `/event.html?id=${encodeURIComponent(event.id)}`, text: event.title })]),
    el('p', { className: 'muted', text: `${event.city} · ${event.venue} · ${formatDate(event.startsAt)}` }),
    el('p', {}, [
      el('span', { className: 'price', text: price }),
      ' ',
      soldOut
        ? el('span', { className: 'badge sold-out', text: 'Sold out' })
        : el('span', { className: 'muted', text: `${event.seatsLeft} seats left` }),
    ]),
  ]);
}

let latestRequest = 0;

async function refresh() {
  const request = ++latestRequest;
  statusLine.textContent = 'Loading events...';
  try {
    const { events } = await listEvents(readOptions());
    if (request !== latestRequest) return; // an newer search already started
    clear(list);
    for (const event of events) list.append(eventCard(event));
    statusLine.textContent = events.length === 0 ? 'No events match. Try changing the filters.' : `${events.length} event(s) found.`;
  } catch (error) {
    if (request !== latestRequest) return;
    clear(list);
    statusLine.textContent = `Something went wrong: ${error.message}`;
  }
}

async function fillCities() {
  const { events } = await listEvents();
  const cities = [...new Set(events.map((event) => event.city))].sort();
  for (const city of cities) citySelect.append(el('option', { value: city, text: city }));
}

for (const control of [searchInput, maxPriceInput]) control.addEventListener('input', refresh);
for (const control of [citySelect, sortSelect]) control.addEventListener('change', refresh);

await fillCities();
await refresh();