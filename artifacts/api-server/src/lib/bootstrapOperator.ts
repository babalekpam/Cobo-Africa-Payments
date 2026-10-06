// First-run bootstrap for a fresh deployment: the client's own administrator and operator
// institution — no sample data, no hardcoded identities. Idempotent and non-destructive:
// an existing admin is never modified (no password reset, no privilege changes), and an
// existing non-admin account is never silently promoted.

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import { validatePassword } from "./security.js";
import { ensureSchemeParticipants } from "../services/scheme/participants.js";
import { loadSchemeConfig } from "../services/scheme/config.js";

export interface BootstrapInput {
  email: string;
  password: string;
  name?: string;
}

export interface BootstrapResult {
  adminCreated: boolean;
}

export async function bootstrapOperator(input: BootstrapInput): Promise<BootstrapResult> {
  const email = (input.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address");

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing && existing.role !== "admin") {
    throw new Error("A non-admin account already uses ADMIN_EMAIL; choose a different address (accounts are never silently promoted)");
  }

  let adminCreated = false;
  if (!existing) {
    const weak = validatePassword(input.password);
    if (weak) throw new Error(`ADMIN_PASSWORD rejected: ${weak}`);
    const name = (input.name || "Administrator").trim().slice(0, 100) || "Administrator";
    const [firstName, ...rest] = name.split(/\s+/);
    const [admin] = await db
      .insert(usersTable)
      .values({
        email,
        name,
        firstName,
        lastName: rest.join(" ") || null,
        passwordHash: bcrypt.hashSync(input.password, 10),
        role: "admin",
        kycStatus: "verified",
        kycLevel: "2",
        isActive: "true",
      })
      .returning();
    const cfg = loadSchemeConfig();
    for (const currency of new Set(["USD", cfg.homeCurrency])) {
      await db.insert(walletsTable).values({ userId: admin.id, currency, isDefault: currency === "USD" });
    }
    adminCreated = true;
  }

  await ensureSchemeParticipants(); // the operator institution (+ demo members only if enabled)
  return { adminCreated };
}
