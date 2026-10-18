const N = 100000; // number of bookings
const LOOKUPS = 1000; // how many times we search

const array = [];
const map = new Map();
for (let i = 1; i <= N; i++) {
  const ref = 'BK-' + String(i).padStart(6, '0');
  const booking = { reference: ref, buyer: 'Person ' + i };
  array.push(booking);
  map.set(ref, booking);
}

// Search for the LAST booking, the worst case for the array
const target = 'BK-' + String(N).padStart(6, '0');

let start = performance.now();
for (let i = 0; i < LOOKUPS; i++) array.find((b) => b.reference === target);
const arrayTime = performance.now() - start;

start = performance.now();
for (let i = 0; i < LOOKUPS; i++) map.get(target);
const mapTime = performance.now() - start;

console.log('Bookings:', N, '| Lookups:', LOOKUPS);
console.log('Array.find:', arrayTime.toFixed(2), 'ms');
console.log('Map.get:   ', mapTime.toFixed(2), 'ms');
console.log('Map was about', Math.round(arrayTime / Math.max(mapTime, 0.001)), 'times faster');