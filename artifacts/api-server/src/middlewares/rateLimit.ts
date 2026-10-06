import rateLimit from "express-rate-limit";
import { rateLimitStore } from "./rateLimitStore.js";

// Every limiter counts in Postgres (shared by all API instances); see rateLimitStore.ts.

export const generalRateLimit = rateLimit({
  store: rateLimitStore("general"),
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please slow down." },
  // The participant gateway has its own limiter (routes/gateway.ts) sized for bank traffic.
  skip: (req) => req.path === "/healthz" || req.path.startsWith("/api/gateway/"),
});

export const authRateLimit = rateLimit({
  store: rateLimitStore("auth"),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
});

export const transferRateLimit = rateLimit({
  store: rateLimitStore("transfer"),
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Transfer limit reached. Please try again in an hour." },
});

// IAPAY directory lookups return account-holder names — throttle hard so the
// alias directory can't be scraped by enumerating phone numbers/emails.
export const directoryLookupRateLimit = rateLimit({
  store: rateLimitStore("directory"),
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many directory lookups. Please slow down." },
});

export const webhookRateLimit = rateLimit({
  store: rateLimitStore("webhook"),
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
