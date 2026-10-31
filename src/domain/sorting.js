import { DomainError } from './errors.js';

// Stable merge sort. It does NOT use Array.prototype.sort.
// It returns a NEW array and never changes the one it is given.

export function mergeSort(items, compare) {
  if (!Array.isArray(items)) {
    throw new DomainError('VALIDATION', 'items must be an array');
  }
  if (typeof compare !== 'function') {
    throw new DomainError('VALIDATION', 'compare must be a function');
  }
  return sortPart(items, compare);
}

function sortPart(list, compare) {
  if (list.length <= 1) return list.slice();
  const middle = Math.floor(list.length / 2);
  const left = sortPart(list.slice(0, middle), compare);
  const right = sortPart(list.slice(middle), compare);
  return merge(left, right, compare);
}

function merge(left, right, compare) {
  const result = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    // <= 0 means: on a tie, take from the LEFT first. This keeps it stable.
    if (compare(left[i], right[j]) <= 0) {
      result.push(left[i]);
      i += 1;
    } else {
      result.push(right[j]);
      j += 1;
    }
  }
  while (i < left.length) {
    result.push(left[i]);
    i += 1;
  }
  while (j < right.length) {
    result.push(right[j]);
    j += 1;
  }
  return result;
}