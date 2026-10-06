// Licensed sanctions screening through an external provider (OpenSanctions match API: consolidated
// OFAC, UN, EU, UK HMT and other official lists, updated daily). Enabled when SANCTIONS_API_KEY is
// set; the built-in list in ofac.ts keeps running as a floor either way.
//
//   SANCTIONS_API_KEY        provider key (enables screening)
//   SANCTIONS_API_URL        default https://api.opensanctions.org
//   SANCTIONS_DATASET        default "sanctions"
//   SANCTIONS_TIMEOUT_MS     default 4000
//
// FAIL CLOSED: if the provider is configured but cannot answer (timeout, outage, bad response) the
// result is "unavailable" and callers must NOT let the payment through.
import { logger } from "./logger.js";

export type ProviderVerdict = "clear" | "hit" | "unavailable" | "disabled";

export function sanctionsProviderEnabled(): boolean {
  return Boolean(process.env.SANCTIONS_API_KEY);
}

export async function screenWithProvider(names: string[]): Promise<ProviderVerdict> {
  const key = process.env.SANCTIONS_API_KEY;
  if (!key) return "disabled";
  const candidates = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 3))];
  if (candidates.length === 0) return "clear";

  const base = (process.env.SANCTIONS_API_URL || "https://api.opensanctions.org").replace(/\/+$/, "");
  const dataset = encodeURIComponent(process.env.SANCTIONS_DATASET || "sanctions");
  const queries = Object.fromEntries(candidates.map((name, i) => [`q${i}`, { schema: "LegalEntity", properties: { name: [name] } }]));
  try {
    const res = await fetch(`${base}/match/${dataset}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `ApiKey ${key}` },
      body: JSON.stringify({ queries }),
      signal: AbortSignal.timeout(Number(process.env.SANCTIONS_TIMEOUT_MS) || 4000),
      redirect: "error",
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "Sanctions provider error — failing closed");
      return "unavailable";
    }
    const body = (await res.json()) as { responses?: Record<string, { results?: Array<{ match?: boolean; score?: number; caption?: string; id?: string }> }> };
    if (!body?.responses) return "unavailable";
    let hit = false;
    for (const [q, r] of Object.entries(body.responses)) {
      for (const m of r.results ?? []) {
        if (m.match === true) {
          hit = true;
          logger.warn({ query: q, entity: m.id, caption: m.caption, score: m.score }, "Sanctions provider match");
        }
      }
    }
    return hit ? "hit" : "clear";
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Sanctions provider unreachable — failing closed");
    return "unavailable";
  }
}
