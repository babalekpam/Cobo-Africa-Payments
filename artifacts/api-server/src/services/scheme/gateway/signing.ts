// Message authentication for the participant gateway. Every message between the
// switch and a participant carries a timestamp and an HMAC-SHA256 over
// `${timestamp}.${rawBody}` with a per-participant shared secret. The timestamp
// bounds replay; the signature binds the exact bytes of the ISO 20022 message.
// (mTLS at the load balancer is the expected second layer in production.)

import { createHmac, timingSafeEqual, createPrivateKey, createPublicKey, sign as edSign, verify as edVerify, type KeyObject } from "crypto";

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

// ---------- Ed25519 (asymmetric) signatures ----------
// A participant that registers an Ed25519 public key signs with its private key, which never leaves
// the bank (an HSM can hold it). Once a key is registered, HMAC is no longer accepted from that
// participant (no downgrade). The scheme signs its own outbound messages with
// GATEWAY_SIGNING_PRIVATE_KEY, published at GET /api/gateway/v1/signing-key.
// Signature header value: "ed25519=" + base64(Ed25519(`${timestamp}.` + body)).


export const ED25519_PREFIX = "ed25519=";

export function parseEd25519PublicKey(pem: string): KeyObject | null {
  try {
    const key = createPublicKey(pem);
    return key.asymmetricKeyType === "ed25519" ? key : null;
  } catch {
    return null;
  }
}

function signedPayload(timestampSec: number, body: string | Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${timestampSec}.`), Buffer.isBuffer(body) ? body : Buffer.from(body)]);
}

export function signEd25519(privateKey: KeyObject, timestampSec: number, body: string | Buffer): string {
  return ED25519_PREFIX + edSign(null, signedPayload(timestampSec, body), privateKey).toString("base64");
}

export function verifyEd25519Signature(opts: {
  publicKey: KeyObject;
  timestamp: string | undefined;
  signature: string | undefined;
  body: string | Buffer;
  nowSec?: number;
  maxSkewSec?: number;
}): { ok: true } | { ok: false; reason: VerifyFailure } {
  const { timestamp, signature } = opts;
  if (!timestamp || !signature) return { ok: false, reason: "missing_fields" };
  if (!/^\d{9,12}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > (opts.maxSkewSec ?? 300)) return { ok: false, reason: "stale" };
  if (!signature.startsWith(ED25519_PREFIX)) return { ok: false, reason: "bad_signature" };
  const sig = Buffer.from(signature.slice(ED25519_PREFIX.length), "base64");
  if (sig.length !== 64) return { ok: false, reason: "bad_signature" };
  try {
    return edVerify(null, signedPayload(Number(timestamp), opts.body), opts.publicKey, sig) ? { ok: true } : { ok: false, reason: "bad_signature" };
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
}

let cachedSchemeKey: { pem: string; key: KeyObject | null } | null = null;

/** The scheme's own Ed25519 signing key (GATEWAY_SIGNING_PRIVATE_KEY, PEM; "\n" escapes allowed). */
export function schemeSigningKey(): KeyObject | null {
  const pem = (process.env.GATEWAY_SIGNING_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!pem) return null;
  if (cachedSchemeKey?.pem === pem) return cachedSchemeKey.key;
  let key: KeyObject | null = null;
  try {
    const k = createPrivateKey(pem);
    key = k.asymmetricKeyType === "ed25519" ? k : null;
  } catch {
    key = null;
  }
  cachedSchemeKey = { pem, key };
  return key;
}

export function schemePublicKeyPem(): string | null {
  const key = schemeSigningKey();
  return key ? createPublicKey(key).export({ type: "spki", format: "pem" }).toString() : null;
}
