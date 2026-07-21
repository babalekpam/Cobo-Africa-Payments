import bcryptjs from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function genRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `IAPAY-${ts}-${rand}`;
}

async function seed() {
  const client = await pool.connect();
  try {
    const adminPwd = process.env.ADMIN_PASSWORD;
    if (!adminPwd) { console.error("ADMIN_PASSWORD env var required"); process.exit(1); }
    const adminHash = bcryptjs.hashSync(adminPwd, 10);
    const passHash = bcryptjs.hashSync("Pass123!", 10);

    await client.query(`
      INSERT INTO users (email, name, password_hash, role, status, phone, country) VALUES
        ('abel@argilette.com', 'Abel Nkawula', $1, 'admin', 'active', '+228 90 123 456', 'Togo'),
        ('ops@iapay.africa', 'Operations Manager', $1, 'admin', 'active', '+234800000000', 'Nigeria'),
        ('merchant1@jumia.africa', 'Jumia Kenya Rep', $2, 'merchant', 'active', '+254711223344', 'Kenya'),
        ('customer1@gmail.com', 'Amina Osei', $2, 'customer', 'active', '+233244100200', 'Ghana'),
        ('customer2@gmail.com', 'Kwame Mensah', $2, 'customer', 'active', '+233244100201', 'Ghana'),
        ('customer3@gmail.com', 'Fatima Al-Rashid', $2, 'customer', 'active', '+201012345679', 'Egypt'),
        ('suspended1@example.com', 'Ibrahim Musa', $2, 'customer', 'suspended', '+2348012345679', 'Nigeria')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, passHash]);
    console.log("Users seeded");

    await client.query(`
      INSERT INTO merchants (name, email, phone, country, status, business_type) VALUES
        ('Jumia Kenya', 'payments@jumia.co.ke', '+254711223344', 'Kenya', 'active', 'E-Commerce'),
        ('Flutterwave Nigeria', 'partners@flutterwave.ng', '+2348012345678', 'Nigeria', 'active', 'Fintech'),
        ('MTN MoMo Ghana', 'momo@mtn.com.gh', '+233244000000', 'Ghana', 'active', 'Mobile Money'),
        ('M-Pesa Tanzania', 'mpesa@vodacom.co.tz', '+255754000000', 'Tanzania', 'active', 'Mobile Money'),
        ('Cairo Digital', 'payments@cairodigital.eg', '+201012345678', 'Egypt', 'pending', 'Digital Services'),
        ('Safaricom Ethiopia', 'biz@safaricom.et', '+251911234567', 'Ethiopia', 'active', 'Telecommunications'),
        ('Interswitch Lagos', 'ops@interswitch.ng', '+2348099887766', 'Nigeria', 'active', 'Fintech'),
        ('Wave Senegal', 'ops@wave.sn', '+221771234567', 'Senegal', 'active', 'Mobile Money')
      ON CONFLICT (email) DO NOTHING
    `);
    console.log("Merchants seeded");

    const { rows: merchants } = await client.query('SELECT id, country FROM merchants');
    
    const countries = ['Kenya', 'Nigeria', 'Ghana', 'Tanzania', 'Egypt', 'Ethiopia', 'South Africa', 'Uganda', 'Senegal', 'Rwanda'];
    const statuses = ['completed', 'completed', 'completed', 'completed', 'pending', 'failed', 'refunded'];
    const types = ['payment', 'transfer', 'withdrawal', 'deposit'];
    const methods = ['M-Pesa', 'MTN MoMo', 'Airtel Money', 'Bank Transfer', 'USSD', 'Card', 'Wave'];
    const currencies = ['KES', 'NGN', 'GHS', 'TZS', 'EGP', 'ETB', 'ZAR', 'RWF'];
    const now = Date.now();
    const seen = new Set();

    for (let i = 0; i < 90; i++) {
      const merchant = merchants[i % merchants.length];
      const daysAgo = Math.floor(Math.random() * 180);
      const createdAt = new Date(now - daysAgo * 86400000);
      const amount = (Math.random() * 9000 + 100).toFixed(2);
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const currency = currencies[i % currencies.length];
      const country = countries[Math.floor(Math.random() * countries.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];
      let ref = genRef();
      while (seen.has(ref)) ref = genRef();
      seen.add(ref);
      
      await client.query(
        'INSERT INTO transactions (reference, amount, currency, status, type, merchant_id, country, payment_method, description, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (reference) DO NOTHING',
        [ref, amount, currency, status, type, merchant.id, country, method, `IAPAY payment transaction #${i+1}`, createdAt]
      );
    }
    console.log("Transactions seeded (90 rows)");
    console.log("Seed complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(e => { console.error(e); process.exit(1); });
