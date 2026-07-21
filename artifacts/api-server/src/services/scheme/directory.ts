// AfriPay Directory — central alias registry for the scheme (equivalent of Pix's DICT).
// Maps an AfriPay Key (phone / email / national id / merchant id / random key) to the
// participant institution and account that should receive funds, network-wide.

import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
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

// COBO itself is a scheme participant — the default institution for aliases registered on this platform
export const HOME_PARTICIPANT_CODE = "COBOPANA";

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
  return [mask(firstName), mask(lastName)].filter(Boolean).join(" ") || "AfriPay user";
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
}

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
    return { ok: false, status: 400, message: `Maximum ${MAX_ALIASES_PER_USER} AfriPay keys per account` };
  }

  const [taken] = await db.select().from(paymentAliasesTable).where(eq(paymentAliasesTable.aliasValue, value));
  if (taken) {
    return {
      ok: false,
      status: 409,
      message: taken.userId === userId ? "You already registered this key" : "This key is already registered to another account",
    };
  }

  const home = await getHomeParticipant();
  if (!home) return { ok: false, status: 500, message: "Scheme home participant not configured" };

  const [alias] = await db
    .insert(paymentAliasesTable)
    .values({
      aliasType,
      aliasValue: value,
      userId,
      participantId: home.id,
      accountRef: `user:${userId}`,
      currency: currency || "USD",
    })
    .returning();

  return { ok: true, status: 201, alias };
}

export interface ResolvedAlias {
  alias: PaymentAlias;
  participant: SchemeParticipant;
  holderName: string;
  holderUserId: number;
}

export async function resolveAlias(rawValue: string): Promise<ResolvedAlias | null> {
  const value = String(rawValue || "").trim();
  if (!value) return null;

  // Try each normalization so lookups work however the sender typed the key
  const candidates = new Set<string>([value]);
  for (const t of ["phone", "email", "national_id", "merchant_id"]) {
    const n = normalizeAlias(t, value);
    if (n) candidates.add(n);
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

  const [holder] = await db.select().from(usersTable).where(eq(usersTable.id, alias.userId));
  if (!holder) return null;

  return {
    alias,
    participant,
    holderName: maskName(holder.firstName, holder.lastName),
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
