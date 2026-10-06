// Settlement exposure — the unsettled net amount a participant owes the scheme.
// Because settlement is deferred (net, every cycle), every payment a bank originates
// is credit the operator extends to it until the cycle closes. The net-debit cap
// bounds that credit; this module computes the number the cap is checked against.
//
//   exposure = Σ sent by P (cleared | pending | unresolved)   — pending/unresolved count
//            − Σ received by P (cleared only)                  — only firm credits offset
//
// Positive = P is a net debtor. All amounts converted to USD; a currency with no
// rate throws, so the switch rejects rather than guessing (fail closed).

export const EXPOSURE_STATUSES = ["cleared", "pending", "unresolved"] as const;

export interface ExposureRow {
  senderParticipantId: number;
  recipientParticipantId: number;
  currency: string;
  recipientCurrency: string;
  amount: number;
  recipientAmount: number;
  status: string;
}

export class MissingRateError extends Error {}

/** `ratesPerUsd[ccy]` = units of ccy per 1 USD (the shape fxRates.getAllRates returns). */
export function toUsd(amount: number, currency: string, ratesPerUsd: Record<string, number>): number {
  const rate = currency === "USD" ? 1 : ratesPerUsd[currency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new MissingRateError(`No USD rate for ${currency}`);
  return amount / rate;
}

export function exposureUsd(participantId: number, rows: ExposureRow[], ratesPerUsd: Record<string, number>): number {
  let total = 0;
  for (const r of rows) {
    if (r.senderParticipantId === participantId && (EXPOSURE_STATUSES as readonly string[]).includes(r.status)) {
      total += toUsd(r.amount, r.currency, ratesPerUsd);
    }
    if (r.recipientParticipantId === participantId && r.status === "cleared") {
      total -= toUsd(r.recipientAmount, r.recipientCurrency, ratesPerUsd);
    }
  }
  return Math.round(total * 100) / 100;
}

/** Would adding `amountUsd` keep the participant within its cap? A cap of 0 admits nothing. */
export function withinNetDebitCap(currentExposureUsd: number, amountUsd: number, capUsd: number): boolean {
  return currentExposureUsd + amountUsd <= capUsd + 1e-9;
}
