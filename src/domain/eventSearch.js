import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

const SORT_OPTIONS = ['date', 'price', 'availability'];

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION', `${field} must be a valid date`);
  }
  return date;
}

// A date-only value like "2026-12-05" means the whole day.
function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function filterEvents(summaries, criteria = {}) {
  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;

  let fromTime = null;
  if (from !== undefined && from !== null) {
    fromTime = parseDate(from, 'from').getTime();
  }

  let toTime = null;
  if (to !== undefined && to !== null) {
    toTime = parseDate(to, 'to').getTime();
    if (isDateOnly(to)) toTime += 24 * 60 * 60 * 1000 - 1;
  }

  if (maxPriceCents !== undefined && maxPriceCents !== null) {
    if (!Number.isInteger(maxPriceCents)) {
      throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number');
    }
  }

  const text = typeof q === 'string' ? q.trim().toLowerCase() : '';
  const wantedCity = typeof city === 'string' ? city.trim().toLowerCase() : '';

  return summaries.filter((item) => {
    if (text) {
      const inTitle = item.title.toLowerCase().includes(text);
      const inVenue = item.venue.toLowerCase().includes(text);
      if (!inTitle && !inVenue) return false;
    }
    if (wantedCity && item.city.toLowerCase() !== wantedCity) return false;

    const time = new Date(item.startsAt).getTime();
    if (fromTime !== null && time < fromTime) return false;
    if (toTime !== null && time > toTime) return false;

    if (maxPriceCents !== undefined && maxPriceCents !== null) {
      if (item.cheapestPriceCents === null) return false;
      if (item.cheapestPriceCents > maxPriceCents) return false;
    }
    if (onlyAvailable && item.seatsLeft <= 0) return false;
    return true;
  });
}

function byTitleThenId(a, b) {
  if (a.title < b.title) return -1;
  if (a.title > b.title) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function sortEvents(summaries, sortBy = 'date') {
  if (!SORT_OPTIONS.includes(sortBy)) {
    throw new DomainError('VALIDATION', `sortBy must be one of: ${SORT_OPTIONS.join(', ')}`);
  }

  let compare;
  if (sortBy === 'date') {
    compare = (a, b) => new Date(a.startsAt) - new Date(b.startsAt) || byTitleThenId(a, b);
  } else if (sortBy === 'price') {
    compare = (a, b) => {
      // No price goes last.
      const pa = a.cheapestPriceCents === null ? Infinity : a.cheapestPriceCents;
      const pb = b.cheapestPriceCents === null ? Infinity : b.cheapestPriceCents;
      if (pa !== pb) return pa < pb ? -1 : 1;
      return byTitleThenId(a, b);
    };
  } else {
    // availability: most seats left first
    compare = (a, b) => b.seatsLeft - a.seatsLeft || byTitleThenId(a, b);
  }
  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria = {}, sortBy = 'date') {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}