// Pure multilateral netting math for Afrix settlement — kept free of database
// imports so it can be unit-tested and reasoned about in isolation.

export interface NettableTransfer {
  senderParticipantId: number;
  recipientParticipantId: number;
  currency: string;
  recipientCurrency: string;
  amount: number;
  recipientAmount: number;
}

export interface NetPosition {
  participantId: number;
  currency: string;
  debit: number; // what this participant owes the network (its customers sent)
  credit: number; // what the network owes this participant (its customers received)
  net: number; // credit - debit
}

export function computeNetPositions(transfers: NettableTransfer[]): NetPosition[] {
  const positions = new Map<string, NetPosition>();
  const bump = (participantId: number, currency: string, field: "debit" | "credit", amount: number) => {
    const key = `${participantId}:${currency}`;
    const pos = positions.get(key) || { participantId, currency, debit: 0, credit: 0, net: 0 };
    pos[field] += amount;
    pos.net = pos.credit - pos.debit;
    positions.set(key, pos);
  };

  for (const t of transfers) {
    bump(t.senderParticipantId, t.currency, "debit", t.amount);
    bump(t.recipientParticipantId, t.recipientCurrency, "credit", t.recipientAmount);
  }
  return [...positions.values()];
}

// Invariant every settlement cycle must satisfy: per currency, total debits
// equal total credits adjusted for FX legs. Within a single currency where both
// legs used that currency, the sum of nets is zero.
export function sumNetByCurrency(positions: NetPosition[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const p of positions) {
    sums[p.currency] = (sums[p.currency] || 0) + p.net;
  }
  return sums;
}
