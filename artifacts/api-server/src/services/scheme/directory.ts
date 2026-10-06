// IAPAY Directory — central alias registry for the scheme (equivalent of Pix's DICT).
// Maps an IAPAY Key (phone / email / national id / merchant id / random key) to the
// participant institution and account that should receive funds, network-wide.

import { randomUUID, randomInt, createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { safeEqual } from "../../lib/security.js";
import { isLockedOut, recordFailedAttempt, clearAttempts } from "../../lib/lockout.js";
import {
  db,
  paymentAliasesTable,
  schemeParticipantsTable,
  usersTable,
  type PaymentAlias,
  type SchemeParticipant,
} from "@workspace/db";

export const ALIAS_TYPES = ["phone", "email", "national_id", "merchant_id", "random"] as const;
export type AliasType = (typeof ALIAS_TYPES)[number];

export const MAX_ALIASES_PER_USER = 5; // Pix allows 5 keys per personal account

// IAPAY itself is a scheme participant — the default institution for aliases registered on this platform
export const HOME_PARTICIPANT_CODE = "IAPAYPAN";

export function normalizeAlias(type: string, value: string): string | null {
  const v = String(value || "").trim();
  if (!v) return null;
  switch (type) {
    case "phone": {
      const digits = v.replace(/[\s\-()]/g, "");
      if (!/^\+?\d{8,15}$/.test(digits)) return null;
      return digits.startsWith("+") ? digits : `+${digits}`;
    }
    case "email": {
      const email = v.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      return email;
    }
    case "national_id": {
      const id = v.toUpperCase().replace(/\s/g, "");
      if (!/^[A-Z0-9\-]{5,25}$/.test(id)) return null;
      return id;
    }
    case "merchant_id": {
      const id = v.toUpperCase().replace(/\s/g, "");
      if (!/^[A-Z0-9\-]{3,30}$/.test(id)) return null;
      return id;
    }
    case "random":
      return randomUUID();
    default:
      return null;
  }
}

// Mask personal data in directory lookups the way Pix does: enough to confirm
// the right recipient, not enough to harvest contact details.
export function maskName(firstName?: string | null, lastName?: string | null): string {
  const mask = (s?: string | null) =>
    s && s.length > 1 ? `${s[0]}${"*".repeat(Math.min(s.length - 1, 6))}` : s || "";
  return [mask(firstName), mask(lastName)].filter(Boolean).join(" ") || "IAPAY user";
}

export async function getHomeParticipant(): Promise<SchemeParticipant | undefined> {
  const [p] = await db
    .select()
    .from(schemeParticipantsTable)
    .where(eq(schemeParticipantsTable.code, HOME_PARTICIPANT_CODE));
  return p;
}

export async function listUserAliases(userId: number): Promise<PaymentAlias[]> {
  return db.select().from(paymentAliasesTable).where(eq(paymentAliasesTable.userId, userId));
}

export interface RegisterAliasResult {
  ok: boolean;
  status: number;
  message?: string;
  alias?: PaymentAlias;
  // Present only when the key needs OTP confirmation: the plaintext code to
  // deliver to the claimed phone/email (never returned to the registrant's API
  // response in production).
  otp?: string;
}

const OTP_TTL_MS = 15 * 60 * 1000;

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Ownership rules, mirroring Pix: phone/email keys must be proven with an OTP
// sent to that phone/email; a national ID key requires verified KYC (identity
// already proven by documents); merchant/random keys carry no claim to prove.
export async function registerAlias(
  userId: number,
  aliasType: string,
  rawValue: string,
  currency: string
): Promise<RegisterAliasResult> {
  if (!ALIAS_TYPES.includes(aliasType as AliasType)) {
    return { ok: false, status: 400, message: `Invalid alias type. Use one of: ${ALIAS_TYPES.join(", ")}` };
  }

  const value = normalizeAlias(aliasType, rawValue);
  if (!value) return { ok: false, status: 400, message: `Invalid ${aliasType} format` };

  const existing = await listUserAliases(userId);
  if (existing.length >= MAX_ALIASES_PER_USER) {
    return { ok: false, status: 400, message: `Maximum ${MAX_ALIASES_PER_USER} IAPAY keys per account` };
  }

  const [taken] = await db.select().from(paymentAliasesTable).where(eq(paymentAliasesTable.aliasValue, value));
  if (taken) {
    return {
      ok: false,
      status: 409,
      message: taken.userId === userId ? "You already registered this key" : "This key is already registered to another account",
    };
  }

  if (aliasType === "national_id") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (user?.kycStatus !== "verified") {
      return { ok: false, status: 403, message: "National ID keys require verified KYC. Complete identity verification first." };
    }
  }

  const home = await getHomeParticipant();
  if (!home) return { ok: false, status: 500, message: "Scheme home participant not configured" };

  const needsOtp = aliasType === "phone" || aliasType === "email";
  const otp = needsOtp ? String(randomInt(100000, 1000000)) : undefined;

  const [alias] = await db
    .insert(paymentAliasesTable)
    .values({
      aliasType,
      aliasValue: value,
      userId,
      participantId: home.id,
      accountRef: `user:${userId}`,
      currency: currency || "USD",
      status: needsOtp ? "pending_verification" : "active",
      verificationCode: otp ? hashOtp(otp) : null,
      verificationExpires: otp ? new Date(Date.now() + OTP_TTL_MS) : null,
    })
    .returning();

  return { ok: true, status: 201, alias, otp };
}

export interface VerifyAliasResult {
  ok: boolean;
  status: number;
  message: string;
  alias?: PaymentAlias;
}

export async function verifyAlias(userId: number, aliasId: number, code: string): Promise<VerifyAliasResult> {
  const [alias] = await db
    .select()
    .from(paymentAliasesTable)
    .where(and(eq(paymentAliasesTable.id, aliasId), eq(paymentAliasesTable.userId, userId)));
  if (!alias) return { ok: false, status: 404, message: "Key not found" };
  if (alias.status === "active") return { ok: true, status: 200, message: "Key is already verified", alias };
  if (alias.status !== "pending_verification" || !alias.verificationCode) {
    return { ok: false, status: 400, message: "This key is not awaiting verification" };
  }
  if (!alias.verificationExpires || alias.verificationExpires.getTime() < Date.now()) {
    return { ok: false, status: 410, message: "Verification code expired. Remove the key and register it again." };
  }

  // A 6-digit OTP is only safe with an attempt cap: 5 wrong guesses locks the
  // key for 15 minutes (and comparison is constant-time).
  const attemptKey = `otp:${alias.id}`;
  if (await isLockedOut(attemptKey)) {
    return { ok: false, status: 429, message: "Too many wrong codes. Try again in 15 minutes." };
  }
  if (!safeEqual(hashOtp(String(code || "").trim()), alias.verificationCode)) {
    const { locked, remaining } = await recordFailedAttempt(attemptKey);
    return {
      ok: false,
      status: locked ? 429 : 400,
      message: locked ? "Too many wrong codes. Try again in 15 minutes." : `Incorrect verification code (${remaining} attempts left)`,
    };
  }
  await clearAttempts(attemptKey);

  const [updated] = await db
    .update(paymentAliasesTable)
    .set({ status: "active", verificationCode: null, verificationExpires: null })
    .where(eq(paymentAliasesTable.id, alias.id))
    .returning();
  return { ok: true, status: 200, message: "Key verified — it is now live in the network directory", alias: updated };
}

export interface ResolvedAlias {
  alias: PaymentAlias;
  participant: SchemeParticipant;
  holderName: string;
  /** Unmasked names for sanctions screening ONLY (each screened separately) — never include in any API response. */
  holderScreenNames: string[];
  /** Platform user who owns the key; null when the key is held by an external participant. */
  holderUserId: number | null;
}

export async function resolveAlias(rawValue: string, opts: { exact?: boolean } = {}): Promise<ResolvedAlias | null> {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  // `exact` (bank messages): the key must match a stored value character for character.
  // Otherwise (human-typed input) try interpretations in a fixed, safe order: phone and email
  // BEFORE the raw string, so a registered numeric "national id" can never shadow the phone
  // number a sender typed without its "+". Set preserves this insertion order.
  const candidates = new Set<string>();
  if (opts.exact) {
    candidates.add(value);
  } else {
    for (const t of ["phone", "email"]) {
      const n = normalizeAlias(t, value);
      if (n) candidates.add(n);
    }
    candidates.add(value);
    for (const t of ["merchant_id", "national_id"]) {
      const n = normalizeAlias(t, value);
      if (n) candidates.add(n);
    }
  }

  let alias: PaymentAlias | undefined;
  for (const candidate of candidates) {
    [alias] = await db
      .select()
      .from(paymentAliasesTable)
      .where(and(eq(paymentAliasesTable.aliasValue, candidate), eq(paymentAliasesTable.status, "active")));
    if (alias) break;
  }
  if (!alias) return null;

  const [participant] = await db
    .select()
    .from(schemeParticipantsTable)
    .where(eq(schemeParticipantsTable.id, alias.participantId));
  if (!participant || participant.status !== "active") return null;

  // External participant key: no platform user, the participant supplied the holder name.
  if (alias.userId === null) {
    const parts = (alias.holderName || "").trim().split(/\s+/).filter(Boolean);
    return {
      alias,
      participant,
      holderName: maskName(parts[0], parts.length > 1 ? parts[parts.length - 1] : null),
      holderScreenNames: parts.length ? [parts.join(" ")] : [],
      holderUserId: null,
    };
  }

  const [holder] = await db.select().from(usersTable).where(eq(usersTable.id, alias.userId));
  if (!holder) return null;

  return {
    alias,
    participant,
    holderName: maskName(holder.firstName, holder.lastName),
    holderScreenNames: [holder.businessName, [holder.firstName, holder.lastName].filter(Boolean).join(" "), holder.name].filter(
      (n, i, all): n is string => !!n && all.indexOf(n) === i
    ),
    holderUserId: holder.id,
  };
}

export async function deleteAlias(userId: number, aliasId: number): Promise<boolean> {
  const [alias] = await db
    .select()
    .from(paymentAliasesTable)
    .where(and(eq(paymentAliasesTable.id, aliasId), eq(paymentAliasesTable.userId, userId)));
  if (!alias) return false;
  await db.delete(paymentAliasesTable).where(eq(paymentAliasesTable.id, aliasId));
  return true;
}
