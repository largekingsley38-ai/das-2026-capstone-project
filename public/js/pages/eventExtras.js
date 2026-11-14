// Extra parts of the event page: refund preview on cancel,
// "Join waitlist" on sold-out tiers, and waitlist offers with a countdown.
// Data comes only from api.js. No fetch here.

import { getEvent, previewRefund, cancelBooking, joinWaitlist, getMyWaitlist, acceptOffer } from '../api.js';
import { el, clear, formatPrice } from '../ui.js';

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function initExtras(ctx) {
  const waitMessage = document.getElementById('wait-message');
  const offersBox = document.getElementById('offers');
  const offersList = document.getElementById('offers-list');
  const cancelButton = document.getElementById('cancel-button');

  let tierNames = new Map();
  let entries = [];
  let offerClocks = [];
  let reloading = false;

  function say(text) {
    waitMessage.textContent = text;
  }

  function render() {
    clear(offersList);
    offerClocks = [];
    offersBox.hidden = entries.length === 0;

    for (const entry of entries) {
      const name = tierNames.get(entry.tierId) ?? 'this tier';
      if (entry.status === 'waiting') {
        offersList.append(
          el('p', { text: `You are on the waitlist for ${name}. We will offer you a seat when one frees up.` }),
        );
        continue;
      }
      const left = el('strong', { text: '' });
      offerClocks.push({ node: left, expiresAt: Date.parse(entry.offerExpiresAt) });
      offersList.append(
        el('div', { className: 'row' }, [
          el('span', { text: `A seat is held for you in ${name}. Time left: ` }),
          left,
          el('button', { type: 'button', text: 'Accept offer', onClick: () => accept(entry) }),
        ]),
      );
    }
    tick();
  }

  async function refreshOffers() {
    if (!ctx.eventId) return;
    try {
      const { tiers } = await getEvent(ctx.eventId);
      tierNames = new Map(tiers.map((tier) => [tier.id, tier.name]));
      const data = await getMyWaitlist();
      entries = data.entries.filter((entry) => tierNames.has(entry.tierId));
    } catch {
      return;
    }
    render();
  }

  function tick() {
    let anyEnded = false;
    for (const clock of offerClocks) {
      const left = Math.max(0, Math.ceil((clock.expiresAt - Date.now()) / 1000));
      clock.node.textContent = formatClock(left);
      if (left === 0) anyEnded = true;
    }
    if (anyEnded && !reloading) {
      reloading = true;
      setTimeout(async () => {
        await refreshOffers();
        reloading = false;
      }, 2000);
    }
  }

  async function accept(entry) {
    try {
      const { booking } = await acceptOffer(entry.id);
      ctx.setBooking(booking);
      const name = tierNames.get(booking.tierId) ?? 'Ticket';
      ctx.checkoutSummary.textContent = `${booking.quantity} x ${name} = ${formatPrice(booking.amountCents)} (reference ${booking.reference})`;
      ctx.checkoutBox.hidden = false;
      ctx.payButton.disabled = false;
      ctx.cardInput.disabled = false;
      ctx.declineBox.disabled = false;
      ctx.showMessage('', '');
      ctx.startCountdown(booking.holdExpiresAt);
      ctx.checkoutBox.scrollIntoView({ behavior: 'smooth' });
      say('');
    } catch (error) {
      say(error.message);
    }
    await refreshOffers();
    await ctx.load();
  }

  async function joinTier(tier) {
    const answer = window.prompt('How many tickets do you want?', '1');
    if (answer === null) return;
    try {
      const { entry } = await joinWaitlist({ tierId: tier.id, quantity: Number(answer) });
      say(`You joined the waitlist. Your place in line: ${entry.position}.`);
    } catch (error) {
      say(error.message);
    }
    await refreshOffers();
  }

  cancelButton.addEventListener('click', async () => {
    const booking = ctx.getBooking();
    if (!booking) return;
    if (booking.status !== 'pending' && booking.status !== 'paid') {
      ctx.showMessage('error', 'This booking is already cancelled.');
      return;
    }
    cancelButton.disabled = true;
    try {
      const preview = await previewRefund(booking.reference);
      const question =
        preview.status === 'paid'
          ? `You will get ${formatPrice(preview.refund.refundCents)} back (${preview.refund.percent}%). Cancel this booking?`
          : 'Cancel this booking? Your seats will be released.';
      if (!window.confirm(question)) return;

      const result = await cancelBooking(booking.reference);
      ctx.stopTimer();
      ctx.setBooking(result.booking);
      ctx.countdownEl.textContent = 'Cancelled';
      ctx.payButton.disabled = true;
      const money = result.booking.refund ? formatPrice(result.booking.refund.refundCents) : formatPrice(0);
      ctx.showMessage('success', `Booking ${result.booking.reference} cancelled. Refund: ${money}.`);
      await ctx.load();
      await refreshOffers();
    } catch (error) {
      ctx.showMessage('error', error.message);
    } finally {
      cancelButton.disabled = false;
    }
  });

  setInterval(tick, 1000);
  setInterval(refreshOffers, 10000);
  refreshOffers();

  return { joinWaitlist: joinTier };
}