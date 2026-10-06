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
//   GATEWAY_PARTICIPANT_SECRETS      JSON {"PARTICIPANTCODE":"shared-secret",...} for inbound signature checks

export interface SchemeConfig {
  name: string;
  homeParticipantName: string;
  homeCountry: string;
  homeCurrency: string;
  seedDemoParticipants: boolean;
  gatewayTimeoutMs: number;
  gatewayMaxClockSkewSec: number;
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
