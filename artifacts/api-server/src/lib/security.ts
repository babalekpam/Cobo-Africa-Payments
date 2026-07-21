// Shared security utilities for the IAPAY API.

// NOTE: deliberately no logger import — this module stays dependency-free so it
// can be unit-tested in isolation; boot-time config warnings live in index.ts.
import { createHash, timingSafeEqual, randomBytes } from "crypto";

export const isProduction = (): boolean => process.env.NODE_ENV === "production";

// CORS allowlist. CORS_ORIGINS env (comma-separated) wins; sensible defaults
// cover the deployed frontend and local development.
export function allowedOrigins(): string[] {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return [
    "https://cob-o.com",
    "https://www.cob-o.com",
    "http://localhost:5173",
    "http://localhost:3000",
  ];
}

// Constant-time string comparison — safe for secrets/OTP hashes of any length.
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// Secret appended to the callback URLs we register with payment providers
// (M-Pesa, MTN, Airtel don't sign their callbacks — the unguessable URL is the
// industry-standard defense). Configure WEBHOOK_CALLBACK_SECRET in production;
// a random per-boot value keeps dev working while rejecting forged calls.
const callbackSecret = process.env.WEBHOOK_CALLBACK_SECRET || randomBytes(24).toString("hex");

export function getCallbackSecret(): string {
  return callbackSecret;
}

// Boot-time config review; returns human-readable warnings for the caller to log.
export function securityConfigWarnings(): string[] {
  const warnings: string[] = [];
  if (!isProduction()) return warnings;
  if (!process.env.WEBHOOK_CALLBACK_SECRET) warnings.push("WEBHOOK_CALLBACK_SECRET not set — provider callbacks use a per-boot secret and will break on restart");
  if (!process.env.FLUTTERWAVE_WEBHOOK_HASH) warnings.push("FLUTTERWAVE_WEBHOOK_HASH not set — Flutterwave webhooks will be rejected (fail closed)");
  if (!process.env.USSD_GATEWAY_SECRET) warnings.push("USSD_GATEWAY_SECRET not set — USSD requests will be rejected (fail closed)");
  if (!process.env.WEBHOOK_SIGNING_SECRET) warnings.push("WEBHOOK_SIGNING_SECRET not set — outgoing merchant webhook signatures change every boot");
  if (!process.env.CORS_ORIGINS) warnings.push("CORS_ORIGINS not set — using built-in default origin allowlist");
  return warnings;
}

export function verifyCallbackSecret(provided: unknown): boolean {
  return typeof provided === "string" && provided.length > 0 && safeEqual(provided, callbackSecret);
}

// Simple in-memory failed-attempt tracker with lockout (per key: phone, alias id…).
// Single-instance deployment; swap for Redis when horizontally scaled.
const attempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function isLockedOut(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) attempts.delete(key);
  return false;
}

export function recordFailedAttempt(key: string): { locked: boolean; remaining: number } {
  const entry = attempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
    attempts.set(key, entry);
    return { locked: true, remaining: 0 };
  }
  attempts.set(key, entry);
  return { locked: false, remaining: MAX_ATTEMPTS - entry.count };
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}

// Password policy: length is what actually matters; block the trivially common.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "11111111", "iloveyou", "sunshine", "letmein1", "admin123",
]);

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password.length > 128) return "Password too long";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "This password is too common — choose another";
  return null;
}
