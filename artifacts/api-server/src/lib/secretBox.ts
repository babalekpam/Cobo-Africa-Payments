// Encryption at rest for participant gateway secrets (AES-256-GCM, authenticated).
// The key comes from GATEWAY_SECRETS_KEY (>= 32 characters; keep it in a secrets manager,
// never in the database or the repo). Without a key the box is unavailable and callers must
// fail closed: secrets are never stored in plaintext.
//
// Stored format: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). Decryption never throws —
// a wrong key, a tampered blob or an unknown version simply yields null.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const VERSION = "v1";

function key(): Buffer | null {
  const k = process.env.GATEWAY_SECRETS_KEY;
  if (!k || k.length < 32) return null;
  return createHash("sha256").update(k).digest();
}

export function secretBoxAvailable(): boolean {
  return key() !== null;
}

/** A fresh 256-bit shared secret, URL-safe (43 characters). */
export function generateParticipantSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) throw new Error("GATEWAY_SECRETS_KEY (>= 32 chars) is required to store participant secrets");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(blob: string): string | null {
  const k = key();
  if (!k) return null;
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
