// Afrix participant onboarding — seeds the scheme's founding member institutions.
// In production each of these would be a licensed bank, mobile money operator or
// fintech connected to the switch through its own API endpoint; here they give the
// network realistic multi-country coverage out of the box.

import { eq } from "drizzle-orm";
import { db, schemeParticipantsTable } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { HOME_PARTICIPANT_CODE } from "./directory.js";

const FOUNDING_PARTICIPANTS = [
  { code: HOME_PARTICIPANT_CODE, name: "COBO Africa Payments", type: "fintech", country: "KE", currency: "USD" },
  { code: "MPESAKEN", name: "M-Pesa (Safaricom)", type: "mobile_money", country: "KE", currency: "KES" },
  { code: "MTNMOGHA", name: "MTN Mobile Money Ghana", type: "mobile_money", country: "GH", currency: "GHS" },
  { code: "MTNMOUGA", name: "MTN Mobile Money Uganda", type: "mobile_money", country: "UG", currency: "UGX" },
  { code: "AIRTELNGA", name: "Airtel Money Nigeria", type: "mobile_money", country: "NG", currency: "NGN" },
  { code: "GTBANKNGA", name: "Guaranty Trust Bank", type: "bank", country: "NG", currency: "NGN" },
  { code: "EQTYBKKEN", name: "Equity Bank Kenya", type: "bank", country: "KE", currency: "KES" },
  { code: "ECOBKCIV", name: "Ecobank Côte d'Ivoire", type: "bank", country: "CI", currency: "XOF" },
  { code: "SBSAZAF", name: "Standard Bank South Africa", type: "bank", country: "ZA", currency: "ZAR" },
  { code: "CBEETHET", name: "Commercial Bank of Ethiopia", type: "bank", country: "ET", currency: "ETB" },
  { code: "ORANGESEN", name: "Orange Money Sénégal", type: "mobile_money", country: "SN", currency: "XOF" },
  { code: "VODATZA", name: "Vodacom M-Pesa Tanzania", type: "mobile_money", country: "TZ", currency: "TZS" },
  { code: "BKKIGRWA", name: "Bank of Kigali", type: "bank", country: "RW", currency: "RWF" },
  { code: "ATTIJMAR", name: "Attijariwafa Bank", type: "bank", country: "MA", currency: "MAD" },
  { code: "NBEEGYPT", name: "National Bank of Egypt", type: "bank", country: "EG", currency: "EGP" },
] as const;

export async function ensureSchemeParticipants(): Promise<void> {
  try {
    for (const p of FOUNDING_PARTICIPANTS) {
      const [existing] = await db.select().from(schemeParticipantsTable).where(eq(schemeParticipantsTable.code, p.code));
      if (!existing) {
        await db.insert(schemeParticipantsTable).values({ ...p });
      }
    }
    logger.info("Afrix scheme participants ensured");
  } catch (err) {
    logger.warn({ err }, "Could not seed Afrix participants (table may not exist yet — run db push)");
  }
}
