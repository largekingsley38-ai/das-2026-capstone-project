// The top menu: shows Log in, or who you are with the links for your role.

import { getSession, clearSession } from './session.js';
import { el } from './ui.js';

const nav = document.getElementById('nav');

if (nav) {
  const session = getSession();
  if (!session) {
    nav.append(el('a', { href: '/login.html', text: 'Log in' }));
  } else {
    const { email, role } = session.user;
    nav.append(el('span', { className: 'muted', text: `${email} (${role})` }), ' ');
    if (role === 'attendee') nav.append(el('a', { href: '/tickets.html', text: 'My tickets' }), ' ');
    if (role === 'organizer') nav.append(el('a', { href: '/organizer.html', text: 'My events' }), ' ');
    nav.append(
      el('button', {
        type: 'button',
        text: 'Log out',
        onClick: () => {
          clearSession();
          location.href = '/';
        },
      }),
    );
  }
}