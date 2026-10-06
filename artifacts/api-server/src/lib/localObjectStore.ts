// Portable KYC document storage on local disk (a mounted volume) — the alternative to the
// Replit-hosted object storage, so a deployment works on any host. Enabled with OBJECT_STORAGE=local;
// files live under LOCAL_STORAGE_DIR (default ./data/objects). Encrypt the underlying volume.
//
// Flow mirrors the presigned-URL flow the frontend already uses:
//   1. POST /kyc/upload-url           -> { uploadURL: "/api/storage/local-upload/<token>", objectPath }
//   2. PUT  <uploadURL> (raw bytes)   -> stored once, under a random id
//   3. GET  /storage/objects/uploads/<id> (authenticated) -> the file
//
// Safety: the upload token is HMAC-signed, expires in 15 minutes and works once (exclusive create);
// only JPEG/PNG/WebP/PDF are accepted; the file's magic bytes must match the declared type; size is
// capped at 10 MB; object ids are validated UUIDs so no path can escape the storage directory.

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { createReadStream, promises as fs, type ReadStream } from "fs";
import path from "path";

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function localStorageEnabled(): boolean {
  return process.env.OBJECT_STORAGE === "local";
}

function baseDir(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || "./data/objects");
}

function signingKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set");
  return createHmac("sha256", secret).update("iapay-local-upload-v1").digest();
}

const sign = (payload: string): string => createHmac("sha256", signingKey()).update(payload).digest("base64url");

export function createLocalUploadURL(contentType: string, now = Date.now()): { uploadURL: string; objectPath: string } {
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(contentType)) {
    throw new Error("Unsupported content type");
  }
  const id = randomUUID();
  const payload = Buffer.from(JSON.stringify({ id, ct: contentType, exp: now + TOKEN_TTL_MS })).toString("base64url");
  return { uploadURL: `/api/storage/local-upload/${payload}.${sign(payload)}`, objectPath: `/objects/uploads/${id}` };
}

export function verifyLocalUploadToken(token: string, now = Date.now()): { id: string; ct: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { id, ct, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id: string; ct: string; exp: number };
    if (!UUID.test(id) || !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(ct) || !(exp > now)) return null;
    return { id, ct };
  } catch {
    return null;
  }
}

/** True if the leading bytes are a real file of the declared type. */
export function matchesDeclaredType(bytes: Buffer, contentType: string): boolean {
  switch (contentType) {
    case "image/jpeg":
      return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    case "application/pdf":
      return bytes.length > 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
    default:
      return false;
  }
}

export type SaveResult = "ok" | "bad_token" | "type_mismatch" | "too_large" | "bad_content" | "already_uploaded";

export async function saveLocalUpload(token: string, contentTypeHeader: string | undefined, body: Buffer): Promise<SaveResult> {
  const claims = verifyLocalUploadToken(token);
  if (!claims) return "bad_token";
  if ((contentTypeHeader || "").split(";")[0].trim().toLowerCase() !== claims.ct) return "type_mismatch";
  if (body.length === 0 || body.length > MAX_UPLOAD_BYTES) return "too_large";
  if (!matchesDeclaredType(body, claims.ct)) return "bad_content";

  const dir = path.join(baseDir(), "uploads");
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    // 'wx' = create exclusively: a token can be used once, and nothing is ever overwritten.
    await fs.writeFile(path.join(dir, claims.id), body, { flag: "wx", mode: 0o600 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return "already_uploaded";
    throw err;
  }
  await fs.writeFile(path.join(dir, `${claims.id}.type`), claims.ct, { mode: 0o600 });
  return "ok";
}

export async function openLocalObject(id: string): Promise<{ stream: ReadStream; size: number; contentType: string } | null> {
  if (!UUID.test(id)) return null; // also blocks "..", slashes and any path tricks
  const file = path.join(baseDir(), "uploads", id);
  try {
    const [stat, type] = await Promise.all([fs.stat(file), fs.readFile(`${file}.type`, "utf8")]);
    if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(type)) return null;
    return { stream: createReadStream(file), size: stat.size, contentType: type };
  } catch {
    return null;
  }
}
