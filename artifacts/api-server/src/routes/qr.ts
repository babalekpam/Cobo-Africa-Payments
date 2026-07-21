import { Router } from "express";
import QRCode from "qrcode";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/qr/receive", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const currency = String(req.query.currency || "USD");
  const amount = req.query.amount ? parseFloat(String(req.query.amount)) : null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));

  const baseUrl = process.env.CLIENT_URL || "https://cob-o.com";
  const params = new URLSearchParams({ to: user.email, currency });
  if (amount && amount > 0) params.set("amount", String(amount));
  const paymentUrl = `${baseUrl}/pay?${params.toString()}`;

  const qrData = JSON.stringify({
    type: "iapay_payment",
    version: 1,
    recipient: user.email,
    name: `${user.firstName} ${user.lastName}`,
    currency,
    amount: amount || null,
    url: paymentUrl,
  });

  const format = (req.query.format as string) || "png";

  if (format === "svg") {
    const svg = await QRCode.toString(qrData, { type: "svg", errorCorrectionLevel: "M" });
    res.set("Content-Type", "image/svg+xml");
    res.send(svg);
  } else if (format === "dataurl") {
    const dataUrl = await QRCode.toDataURL(qrData, { errorCorrectionLevel: "M", width: 300 });
    res.json({ success: true, dataUrl, paymentUrl, currency, amount });
  } else {
    const buffer = await QRCode.toBuffer(qrData, { errorCorrectionLevel: "M", width: 300 });
    res.set("Content-Type", "image/png");
    res.send(buffer);
  }
});

router.get("/qr/link/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const baseUrl = process.env.CLIENT_URL || "https://cob-o.com";
  const url = `${baseUrl}/pay/${slug}`;
  const buffer = await QRCode.toBuffer(url, { errorCorrectionLevel: "M", width: 300 });
  res.set("Content-Type", "image/png");
  res.send(buffer);
});

export default router;
