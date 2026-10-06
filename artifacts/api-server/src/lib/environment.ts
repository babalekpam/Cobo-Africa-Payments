// Is this installation a SANDBOX (test money, simulated payouts, for demos and client testing) or
// LIVE (real money)? Set IAPAY_ENVIRONMENT=sandbox|live. If unset: live in production, sandbox
// otherwise — so a production deployment never silently runs sandbox shortcuts.
//
// Sandbox-only behaviour: self-service test funding (/wallets/fund), simulated mobile-money and bank
// payouts when no provider is configured, and simulated checkout payments. In LIVE every one of
// these is refused: money only enters through a verified deposit or a real provider, and only
// leaves through a confirmed payout.
export type IapayEnvironment = "sandbox" | "live";

export function iapayEnvironment(): IapayEnvironment {
  const v = (process.env.IAPAY_ENVIRONMENT || "").trim().toLowerCase();
  if (v === "sandbox" || v === "live") return v;
  return process.env.NODE_ENV === "production" ? "live" : "sandbox";
}

export const isSandbox = (): boolean => iapayEnvironment() === "sandbox";
