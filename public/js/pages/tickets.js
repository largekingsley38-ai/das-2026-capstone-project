// My tickets page. Data comes only from api.js. No fetch here.

import { getMyBookings } from '../api.js';
import { getSession } from '../session.js';
import { el, clear, formatPrice } from '../ui.js';

const statusLine = document.getElementById('status');
const list = document.getElementById('bookings');

async function load() {
  if (!getSession()) {
    statusLine.textContent = 'Please log in to see your tickets.';
    list.append(el('a', { href: '/login.html', text: 'Log in' }));
    return;
  }
  statusLine.textContent = 'Loading your tickets...';
  try {
    const { bookings } = await getMyBookings();
    clear(list);
    statusLine.textContent = bookings.length === 0 ? 'You have no bookings yet.' : '';
    for (const booking of bookings) {
      list.append(
        el('div', { className: 'card' }, [
          el('h3', { text: `Reference ${booking.reference}` }),
          el('p', { text: `${booking.quantity} ticket(s) - ${formatPrice(booking.amountCents)}` }),
          el('p', { className: 'muted', text: `Status: ${booking.status}` }),
        ]),
      );
    }
  } catch (error) {
    clear(list);
    statusLine.textContent = `Something went wrong: ${error.message}`;
  }
}

load();