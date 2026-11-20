// Organizer page: create an event with a tier, then publish it.
// Data comes only from api.js. No fetch here.

import { createEvent, addTier, setPublished } from '../api.js';
import { getSession } from '../session.js';
import { el, clear } from '../ui.js';

const messageBox = document.getElementById('org-message');
const statusLine = document.getElementById('status');
const list = document.getElementById('events');
const createButton = document.getElementById('create-button');
const field = (id) => document.getElementById(id);

const myEvents = [];

function showMessage(kind, text) {
  clear(messageBox);
  if (text) messageBox.append(el('p', { className: `message ${kind}`, text }));
}

function render() {
  clear(list);
  for (const item of myEvents) {
    const publishButton = el('button', {
      type: 'button',
      text: item.published ? 'Unpublish' : 'Publish',
      onClick: async () => {
        publishButton.disabled = true;
        try {
          await setPublished(item.id, !item.published);
          item.published = !item.published;
          showMessage('success', item.published ? 'Event published.' : 'Event unpublished.');
        } catch (error) {
          showMessage('error', error.message);
        }
        render();
      },
    });
    list.append(
      el('div', { className: 'card' }, [
        el('h3', { text: item.title }),
        el('p', { className: 'muted', text: item.published ? 'Published' : 'Draft' }),
        el('div', { className: 'row' }, [publishButton]),
      ]),
    );
  }
  statusLine.textContent = myEvents.length === 0 ? 'No events created in this visit yet.' : '';
}

createButton.addEventListener('click', async () => {
  const session = getSession();
  if (!session || session.user.role !== 'organizer') {
    showMessage('error', 'Only organizer accounts can create events. Please log in as an organizer.');
    return;
  }
  createButton.disabled = true;
  showMessage('', '');
  try {
    const startsAt = field('starts').value ? new Date(field('starts').value).toISOString() : '';
    const { event } = await createEvent({
      title: field('title').value,
      city: field('city').value,
      venue: field('venue').value,
      startsAt,
    });
    await addTier(event.id, {
      name: field('tier-name').value,
      priceCents: Math.round(Number(field('tier-price').value) * 100),
      capacity: Number(field('tier-capacity').value),
    });
    myEvents.unshift({ id: event.id, title: event.title, published: false });
    showMessage('success', 'Event created with its tier. Tap Publish to put it on sale.');
    render();
  } catch (error) {
    showMessage('error', error.message);
  } finally {
    createButton.disabled = false;
  }
});

render();