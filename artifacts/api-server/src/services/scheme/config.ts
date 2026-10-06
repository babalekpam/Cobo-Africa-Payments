// Deployment profile for the scheme. Nothing about IAPAY's rules is tied to a
// country: whoever deploys it (a bank, a central bank, a regional operator) sets
// these env vars and gets their own branded, correctly-denominated scheme.
//
//   SCHEME_NAME                      display name                        (default "IAPAY")
//   SCHEME_HOME_PARTICIPANT_NAME     the operator institution's name     (default "IAPAY (Intra-African Payments)")
//   SCHEME_HOME_COUNTRY              ISO 3166-1 alpha-2 of the operator  (default "KE")
//   SCHEME_HOME_CURRENCY             operator settlement currency        (default "USD")
//   SCHEME_SEED_DEMO_PARTICIPANTS    "false" to skip the 14 demo members (default "true"; set false for real deployments)
//   GATEWAY_TIMEOUT_MS               outbound participant call timeout   (default 8000)
//   GATEWAY_MAX_CLOCK_SKEW_SEC       signed-message replay window        (default 300)
//   GATEWAY_MAX_SINGLE_AMOUNT_USD    per-payment ceiling from a bank     (default 10000)
//   GATEWAY_DEFAULT_NET_DEBIT_CAP_USD cap for banks with none set        (default 0 = fail closed)
//   GATEWAY_PARTICIPANT_SECRETS      JSON {"PARTICIPANTCODE":"shared-secret",...} for inbound signature checks

export interface SchemeConfig {
  name: string;
  homeParticipantName: string;
  homeCountry: string;
  homeCurrency: string;
  seedDemoParticipants: boolean;
  gatewayTimeoutMs: number;
  gatewayMaxClockSkewSec: number;
  /** Largest single payment (USD-equivalent) accepted from an external participant. */
  gatewayMaxSingleAmountUsd: number;
  /**
   * Net-debit cap (USD) applied to an external participant that has no cap of its own.
   * Defaults to 0 — fail closed: a bank cannot originate payments until the operator
   * sets its cap, because unsettled credit extended to it is the operator's risk.
   */
  defaultNetDebitCapUsd: number;
}

type Env = Record<string, string | undefined>;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function loadSchemeConfig(env: Env = process.env): SchemeConfig {
  const country = (env.SCHEME_HOME_COUNTRY || "KE").trim().toUpperCase();
  const currency = (env.SCHEME_HOME_CURRENCY || "USD").trim().toUpperCase();
  return {
    name: env.SCHEME_NAME?.trim() || "IAPAY",
    homeParticipantName: env.SCHEME_HOME_PARTICIPANT_NAME?.trim() || "IAPAY (Intra-African Payments)",
    homeCountry: /^[A-Z]{2}$/.test(country) ? country : "KE",
    homeCurrency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
    seedDemoParticipants: (env.SCHEME_SEED_DEMO_PARTICIPANTS ?? "true").trim().toLowerCase() !== "false",
    gatewayTimeoutMs: positiveInt(env.GATEWAY_TIMEOUT_MS, 8000),
    gatewayMaxClockSkewSec: positiveInt(env.GATEWAY_MAX_CLOCK_SKEW_SEC, 300),
    gatewayMaxSingleAmountUsd: positiveInt(env.GATEWAY_MAX_SINGLE_AMOUNT_USD, 10000),
    defaultNetDebitCapUsd: Math.max(0, Number(env.GATEWAY_DEFAULT_NET_DEBIT_CAP_USD) || 0),
  };
}

/** Per-participant shared secrets for inbound gateway signatures. Malformed config yields none (fail closed). */
export function loadParticipantSecrets(env: Env = process.env): Record<string, string> {
  const raw = env.GATEWAY_PARTICIPANT_SECRETS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [code, secret] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof secret === "string" && secret.length >= 16) out[code] = secret;
    }
    return out;
  } catch {
    return {};
  }
}
