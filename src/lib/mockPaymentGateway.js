import { randomUUID } from 'node:crypto';

// A fake payment provider. It never sees a card number.
// charge({ decline: true }) simulates a declined card.
export function createMockPaymentGateway() {
  const charges = [];

  return {
    async charge({ amountCents, reference, decline = false }) {
      if (decline) return { ok: false, reason: 'CARD_DECLINED' };
      const chargeId = randomUUID();
      charges.push({ chargeId, reference, amountCents });
      return { ok: true, chargeId };
    },
    // For tests: how many times was money really taken?
    chargeCount() {
      return charges.length;
    },
  };
}