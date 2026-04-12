import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const BASE = process.env.CLIENT_URL || "https://cobo.africa";
const G = "#C8921A";

function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;background:#FAF7F2;padding:20px;margin:0}.card{background:#fff;border:1px solid #EBE4D6;border-radius:12px;padding:32px;max-width:520px;margin:0 auto}.logo{font-family:Georgia,serif;font-size:22px;color:${G};font-weight:700;margin-bottom:20px}.btn{display:inline-block;padding:12px 28px;background:${G};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:18px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F5F0E8;font-size:14px;color:#2C2416}.footer{text-align:center;color:#9A8F75;font-size:12px;margin-top:20px}</style></head><body><div class="card"><div class="logo">COBO <span style="font-size:10px;color:#9A8F75;letter-spacing:3px">AFRICA PAYMENTS</span></div>${body}</div><div class="footer">&copy; ${new Date().getFullYear()} COBO &middot; <a href="${BASE}/terms" style="color:#7A6E58">Terms</a> &middot; <a href="${BASE}/privacy" style="color:#7A6E58">Privacy</a></div></body></html>`;
}

async function send(to: string, subject: string, body: string) {
  const t = await getTransporter();
  if (!t) {
    console.log(`[EMAIL] (no SMTP) To: ${to} | ${subject}`);
    return;
  }
  try {
    await t.sendMail({
      from: `"COBO Payments" <${process.env.FROM_EMAIL || "noreply@cobo.africa"}>`,
      to,
      subject,
      html: wrap(body),
    });
  } catch (e: any) {
    console.error("[EMAIL]", e.message);
  }
}

export const emailService = {
  sendWelcomeEmail: (u: any) =>
    send(u.email, "Welcome to COBO", `<h2 style="color:${G}">Welcome, ${u.firstName || u.first_name}!</h2><p style="color:#2C2416;margin-bottom:20px">Your COBO account is ready.</p><a href="${BASE}/verification" class="btn">Complete Verification</a>`),

  sendPasswordResetEmail: (u: any, url: string) =>
    send(u.email, "Reset your COBO password", `<h2 style="color:${G}">Password Reset</h2><p style="color:#2C2416;margin-bottom:20px">Hi ${u.firstName || u.first_name}, click below to reset your password. <strong>Expires in 1 hour.</strong></p><a href="${url}" class="btn">Reset Password</a><p style="color:#9A8F75;font-size:12px;margin-top:20px">If you didn't request this, ignore this email.</p>`),

  sendPasswordChangedEmail: (u: any) =>
    send(u.email, "Your COBO password was changed", `<h2 style="color:${G}">Password Changed</h2><p style="color:#2C2416">Hi ${u.firstName || u.first_name}, your COBO password was changed. If this wasn't you, contact support immediately.</p>`),

  sendTransferSentEmail: (u: any, d: { amount: number; currency: string; recipient: string; reference: string; fee: number }) =>
    send(u.email, `Transfer of ${d.currency} ${d.amount.toLocaleString()} initiated`, `<h2 style="color:${G}">Transfer Initiated</h2><div class="row"><span>Amount</span><span style="color:${G};font-weight:600">${d.currency} ${d.amount.toLocaleString()}</span></div><div class="row"><span>Fee</span><span>${d.currency} ${d.fee.toFixed(2)}</span></div><div class="row"><span>Recipient</span><span>${d.recipient}</span></div><div class="row" style="border:none"><span>Reference</span><span style="font-family:monospace;font-size:12px">${d.reference}</span></div>`),

  sendTransferReceivedEmail: (u: any, d: { amount: number; currency: string; sender: string; reference: string }) =>
    send(u.email, `You received ${d.currency} ${d.amount.toLocaleString()} on COBO`, `<h2 style="color:#157a40">Money Received!</h2><div style="background:#edf7f2;border-radius:8px;padding:20px;text-align:center;margin-bottom:16px"><div style="font-size:32px;font-weight:700;color:#157a40">+${d.currency} ${d.amount.toLocaleString()}</div><div style="color:#9A8F75;margin-top:6px">from ${d.sender}</div></div>`),

  sendLoginAlertEmail: (u: any, d: { ip: string; device: string }) =>
    send(u.email, "New login to your COBO account", `<h2 style="color:${G}">New Login Detected</h2><p style="color:#2C2416;margin-bottom:16px">Hi ${u.firstName || u.first_name}, a new login was detected.</p><div class="row"><span>Time</span><span>${new Date().toLocaleString()}</span></div><div class="row"><span>IP</span><span style="font-family:monospace">${d.ip}</span></div><div class="row" style="border:none"><span>Device</span><span>${d.device || "Unknown"}</span></div>`),
};
