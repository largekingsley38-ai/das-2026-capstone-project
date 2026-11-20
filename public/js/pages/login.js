// Login page. Data comes only from api.js. No fetch here.

import { login, signup } from '../api.js';
import { getSession } from '../session.js';
import { el, clear } from '../ui.js';

const messageBox = document.getElementById('login-message');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const roleSelect = document.getElementById('role');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');

function showMessage(kind, text) {
  clear(messageBox);
  if (text) messageBox.append(el('p', { className: `message ${kind}`, text }));
}

function nextPage(role) {
  return role === 'organizer' ? '/organizer.html' : role === 'attendee' ? '/tickets.html' : '/';
}

async function submit(action, input) {
  loginButton.disabled = true;
  signupButton.disabled = true;
  showMessage('', '');
  try {
    const { user } = await action(input);
    const saved = getSession();
    if (saved) {
      showMessage('success', `Login saved for ${saved.user.email}. Going to the next page...`);
      setTimeout(() => {
        location.href = nextPage(user.role);
      }, 1500);
    } else {
      showMessage('error', 'The server accepted you, but this browser did NOT save the login.');
      loginButton.disabled = false;
      signupButton.disabled = false;
    }
  } catch (error) {
    showMessage('error', error.message);
    loginButton.disabled = false;
    signupButton.disabled = false;
  }
}

loginButton.addEventListener('click', () =>
  submit(login, { email: emailInput.value, password: passwordInput.value }),
);
signupButton.addEventListener('click', () =>
  submit(signup, { email: emailInput.value, password: passwordInput.value, role: roleSelect.value }),
);