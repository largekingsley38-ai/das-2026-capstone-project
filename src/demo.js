const { Event } = require('./event');

const event = new Event('Lagos Music Night');
event.addTier('VIP', 1500000, 2);
event.addTier('Regular', 500000, 3);
console.log('Event created:', event.name);

const a = event.book('VIP', 'Ada');
console.log('Ada booked VIP:', a.booking.reference);
const b = event.book('VIP', 'Chidi');
console.log('Chidi booked VIP:', b.booking.reference);

const c = event.book('VIP', 'Ngozi');
console.log('Ngozi tries VIP:', c.ok ? 'booked' : 'refused (' + c.reason + ')');

console.log('Ngozi joins waitlist, position', event.joinWaitlist('VIP', 'Ngozi'));
console.log('Emeka joins waitlist, position', event.joinWaitlist('VIP', 'Emeka'));

const found = event.findBooking(a.booking.reference);
console.log('Lookup', a.booking.reference, '->', found.buyer, found.tierName, found.priceKobo, 'kobo');

