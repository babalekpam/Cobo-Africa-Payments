// SMS delivery for OTPs and payment alerts. Providers are picked by env config:
// Africa's Talking (AT_API_KEY + AT_USERNAME) or Twilio (TWILIO_ACCOUNT_SID +
// TWILIO_AUTH_TOKEN + TWILIO_FROM). With neither configured it logs to console
// (graceful no-op, same pattern as the email service).

import { logger } from "../lib/logger.js";

export async function sendSms(to: string, message: string): Promise<boolean> {
  if (process.env.AT_API_KEY && process.env.AT_USERNAME) {
    try {
      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: process.env.AT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ username: process.env.AT_USERNAME, to, message }),
      });
      if (res.ok) return true;
      logger.warn({ status: res.status }, "Africa's Talking SMS failed");
    } catch (err) {
      logger.warn({ err }, "Africa's Talking SMS error");
    }
    return false;
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: message }),
      });
      if (res.ok) return true;
      logger.warn({ status: res.status }, "Twilio SMS failed");
    } catch (err) {
      logger.warn({ err }, "Twilio SMS error");
    }
    return false;
  }

  logger.info({ to }, `[SMS] (no provider configured) ${message}`);
  return true;
}
