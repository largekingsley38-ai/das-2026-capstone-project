// Remembers who is logged in, in this browser.
// The server still checks the token on every request. This is only a memory.

const KEY = 'ticketing-session';

export function getSession() {
  try {
    const text = localStorage.getItem(KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage can be blocked. The page still works until it reloads.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}