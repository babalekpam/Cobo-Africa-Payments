// Message authentication for the participant gateway. Every message between the
// switch and a participant carries a timestamp and an HMAC-SHA256 over
// `${timestamp}.${rawBody}` with a per-participant shared secret. The timestamp
// bounds replay; the signature binds the exact bytes of the ISO 20022 message.
// (mTLS at the load balancer is the expected second layer in production.)

import { createHmac, timingSafeEqual } from "crypto";

export const SIGNATURE_HEADERS = {
  participant: "x-iapay-participant",
  timestamp: "x-iapay-timestamp",
  signature: "x-iapay-signature",
} as const;

// The HMAC covers the exact bytes on the wire: pass the raw Buffer when verifying
// inbound requests so no decode/re-encode step can alter what was signed.
export function signMessage(secret: string, timestampSec: number, body: string | Buffer): string {
  return createHmac("sha256", secret).update(`${timestampSec}.`).update(body).digest("hex");
}

export type VerifyFailure = "missing_fields" | "bad_timestamp" | "stale" | "bad_signature";

export function verifySignature(opts: {
  secret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  body: string | Buffer;
  nowSec?: number;
  maxSkewSec?: number;
}): { ok: true } | { ok: false; reason: VerifyFailure } {
  const { secret, timestamp, signature, body } = opts;
  if (!timestamp || !signature) return { ok: false, reason: "missing_fields" };
  if (!/^\d{9,12}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > (opts.maxSkewSec ?? 300)) return { ok: false, reason: "stale" };

  const expected = Buffer.from(signMessage(secret, Number(timestamp), body), "hex");
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
