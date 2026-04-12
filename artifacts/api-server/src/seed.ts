import { db, usersTable, merchantsTable, transactionsTable, walletsTable, notificationsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

function generateRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `COBO-${ts}-${rand}`;
}

async function seed() {
  logger.info("Starting seed...");

  const adminHash = bcrypt.hashSync("CoboAdmin2024!", 10);

  await db
    .insert(usersTable)
    .values([
      {
        email: "admin@cobo.africa",
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

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, "admin@cobo.africa"));
  if (admin) {
    await db.update(usersTable).set({
      firstName: "Abel", lastName: "Nkawula", name: "Abel Nkawula",
      businessName: "ARGILETTE LLC", kycStatus: "verified", kycLevel: "2",
      country: "TG",
    }).where(eq(usersTable.id, admin.id));

    const existingWallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, admin.id));
    if (existingWallets.length === 0) {
      await db.insert(walletsTable).values([
        { userId: admin.id, currency: "USD", balance: "4820.50", isDefault: true },
        { userId: admin.id, currency: "NGN", balance: "1250000.00" },
        { userId: admin.id, currency: "XOF", balance: "385000.00" },
        { userId: admin.id, currency: "GHS", balance: "6200.00" },
      ]);
      logger.info("Admin wallets seeded");
    }

    const existingNotif = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, admin.id));
    if (existingNotif.length === 0) {
      await db.insert(notificationsTable).values([
        { userId: admin.id, title: "Welcome to COBO! 🌍", message: "Your account is ready. Complete KYC to unlock full limits.", type: "success" },
        { userId: admin.id, title: "⚙ Admin access granted", message: "You are the admin — full access to all features.", type: "info" },
      ]);
    }
  }

  await db
    .insert(merchantsTable)
    .values([
      { name: "Jumia Kenya", email: "payments@jumia.co.ke", phone: "+254711223344", country: "Kenya", status: "active", businessType: "E-Commerce" },
      { name: "Flutterwave Nigeria", email: "partners@flutterwave.ng", phone: "+2348012345678", country: "Nigeria", status: "active", businessType: "Fintech" },
      { name: "MTN MoMo Ghana", email: "momo@mtn.com.gh", phone: "+233244000000", country: "Ghana", status: "active", businessType: "Mobile Money" },
      { name: "M-Pesa Tanzania", email: "mpesa@vodacom.co.tz", phone: "+255754000000", country: "Tanzania", status: "active", businessType: "Mobile Money" },
      { name: "Cairo Digital", email: "payments@cairodigital.eg", phone: "+201012345678", country: "Egypt", status: "pending", businessType: "Digital Services" },
      { name: "Safaricom Ethiopia", email: "biz@safaricom.et", phone: "+251911234567", country: "Ethiopia", status: "active", businessType: "Telecommunications" },
    ])
    .onConflictDoNothing();

  logger.info("Merchants seeded");

  const merchants = await db.select().from(merchantsTable);
  const countries = ["Kenya", "Nigeria", "Ghana", "Tanzania", "Egypt", "Ethiopia", "South Africa", "Uganda"];
  const statuses = ["completed", "completed", "completed", "completed", "pending", "failed"] as const;
  const types = ["payment", "transfer", "send", "deposit"] as const;
  const methods = ["M-Pesa", "MTN MoMo", "Airtel Money", "Bank Transfer", "USSD", "Card"];
  const currencies = ["KES", "NGN", "GHS", "TZS", "EGP", "ETB", "ZAR"];

  const existingTx = await db.select().from(transactionsTable);
  if (existingTx.length < 10) {
    const txValues = [];
    const now = new Date();
    for (let i = 0; i < 80; i++) {
      const merchant = merchants[i % merchants.length];
      const daysAgo = Math.floor(Math.random() * 180);
      const createdAt = new Date(now.getTime() - daysAgo * 86400000);
      txValues.push({
        reference: generateRef(),
        amount: String((Math.random() * 9000 + 100).toFixed(2)),
        currency: currencies[i % currencies.length],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        type: types[Math.floor(Math.random() * types.length)],
        merchantId: merchant.id,
        customerId: admin?.id,
        country: countries[Math.floor(Math.random() * countries.length)],
        paymentMethod: methods[Math.floor(Math.random() * methods.length)],
        description: `Payment from COBO platform - transaction ${i + 1}`,
        createdAt,
      });
    }
    await db.insert(transactionsTable).values(txValues).onConflictDoNothing();
    logger.info("Transactions seeded");
  }

  logger.info("Seed complete!");
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
