import { db, usersTable, merchantsTable, transactionsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
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
        name: "COBO Admin",
        passwordHash: adminHash,
        role: "admin",
        status: "active",
        phone: "+254700000000",
        country: "Kenya",
      },
      {
        email: "ops@cobo.africa",
        name: "Operations Manager",
        passwordHash: bcrypt.hashSync("Ops2024!", 10),
        role: "admin",
        status: "active",
        phone: "+234800000000",
        country: "Nigeria",
      },
      {
        email: "merchant1@jumia.africa",
        name: "Jumia Kenya Rep",
        passwordHash: bcrypt.hashSync("Pass123!", 10),
        role: "merchant",
        status: "active",
        country: "Kenya",
      },
      {
        email: "customer1@gmail.com",
        name: "Amina Osei",
        passwordHash: bcrypt.hashSync("Pass123!", 10),
        role: "customer",
        status: "active",
        country: "Ghana",
      },
      {
        email: "customer2@gmail.com",
        name: "Kwame Mensah",
        passwordHash: bcrypt.hashSync("Pass123!", 10),
        role: "customer",
        status: "active",
        country: "Ghana",
      },
    ])
    .onConflictDoNothing();

  logger.info("Users seeded");

  await db
    .insert(merchantsTable)
    .values([
      {
        name: "Jumia Kenya",
        email: "payments@jumia.co.ke",
        phone: "+254711223344",
        country: "Kenya",
        status: "active",
        businessType: "E-Commerce",
      },
      {
        name: "Flutterwave Nigeria",
        email: "partners@flutterwave.ng",
        phone: "+2348012345678",
        country: "Nigeria",
        status: "active",
        businessType: "Fintech",
      },
      {
        name: "MTN MoMo Ghana",
        email: "momo@mtn.com.gh",
        phone: "+233244000000",
        country: "Ghana",
        status: "active",
        businessType: "Mobile Money",
      },
      {
        name: "M-Pesa Tanzania",
        email: "mpesa@vodacom.co.tz",
        phone: "+255754000000",
        country: "Tanzania",
        status: "active",
        businessType: "Mobile Money",
      },
      {
        name: "Cairo Digital",
        email: "payments@cairodigital.eg",
        phone: "+201012345678",
        country: "Egypt",
        status: "pending",
        businessType: "Digital Services",
      },
      {
        name: "Safaricom Ethiopia",
        email: "biz@safaricom.et",
        phone: "+251911234567",
        country: "Ethiopia",
        status: "active",
        businessType: "Telecommunications",
      },
    ])
    .onConflictDoNothing();

  logger.info("Merchants seeded");

  const merchants = await db.select().from(merchantsTable);
  const countries = ["Kenya", "Nigeria", "Ghana", "Tanzania", "Egypt", "Ethiopia", "South Africa", "Uganda"];
  const statuses = ["completed", "completed", "completed", "completed", "pending", "failed", "refunded"] as const;
  const types = ["payment", "transfer", "withdrawal", "deposit"] as const;
  const methods = ["M-Pesa", "MTN MoMo", "Airtel Money", "Bank Transfer", "USSD", "Card"];
  const currencies = ["KES", "NGN", "GHS", "TZS", "EGP", "ETB", "ZAR"];

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
      country: countries[Math.floor(Math.random() * countries.length)],
      paymentMethod: methods[Math.floor(Math.random() * methods.length)],
      description: `Payment from COBO platform - transaction ${i + 1}`,
      createdAt,
    });
  }

  await db.insert(transactionsTable).values(txValues).onConflictDoNothing();

  logger.info("Transactions seeded");
  logger.info("Seed complete!");
}

seed().catch((err) => {
  logger.error(err, "Seed failed");
  process.exit(1);
});
