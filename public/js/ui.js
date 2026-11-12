// Small helpers for building the page. We never use innerHTML:
// text goes in with textContent, so data can never run as code.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') {
      node.textContent = value;
    } else if (key === 'className') {
      node.className = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(value));
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Removes everything inside a node.
export function clear(node) {
  node.replaceChildren();
}

// The ONE place that shows money. Prices are whole cents.
// 250000 -> ₦2,500
export function formatPrice(cents) {
  const naira = cents / 100;
  const text = naira.toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return '\u20A6' + text;
}