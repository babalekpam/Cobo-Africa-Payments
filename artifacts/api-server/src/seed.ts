import { db, usersTable, walletsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

async function seed() {
  logger.info("Starting seed...");

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    logger.error("ADMIN_PASSWORD environment variable is required");
    process.exit(1);
  }
  const adminHash = bcrypt.hashSync(adminPassword, 10);

  await db
    .insert(usersTable)
    .values([
      {
        email: "abel@argilette.com",
        name: "Abel Nkawula",
        firstName: "Abel",
        lastName: "Nkawula",
        passwordHash: adminHash,
        role: "admin",
        status: "active",
        phone: "+228 90 123 456",
        country: "TG",
        businessName: "ARGILETTE LLC",
        businessType: "individual",
        kycStatus: "verified",
        kycLevel: "2",
        isActive: "true",
      },
    ])
    .onConflictDoNothing();

  logger.info("Users seeded");

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, "abel@argilette.com"));
  if (admin) {
    await db.update(usersTable).set({
      firstName: "Abel", lastName: "Nkawula", name: "Abel Nkawula",
      businessName: "ARGILETTE LLC", kycStatus: "verified", kycLevel: "2",
      country: "TG",
    }).where(eq(usersTable.id, admin.id));

    const existingWallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, admin.id));
    if (existingWallets.length === 0) {
      await db.insert(walletsTable).values([
        { userId: admin.id, currency: "USD", balance: "0", isDefault: true },
        { userId: admin.id, currency: "NGN", balance: "0" },
        { userId: admin.id, currency: "XOF", balance: "0" },
        { userId: admin.id, currency: "GHS", balance: "0" },
      ]);
      logger.info("Admin wallets seeded");
    }
  }

  logger.info("Seed complete!");
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
