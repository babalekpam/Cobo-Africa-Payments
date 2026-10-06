import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);

// src/tests/security.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/lib/security.ts
import { createHash, timingSafeEqual, randomBytes } from "crypto";
function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}
var callbackSecret = process.env.WEBHOOK_CALLBACK_SECRET || randomBytes(24).toString("hex");
var attempts = /* @__PURE__ */ new Map();
var MAX_ATTEMPTS = 5;
var LOCKOUT_MS = 15 * 60 * 1e3;
function isLockedOut(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) attempts.delete(key);
  return false;
}
function recordFailedAttempt(key) {
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
function clearAttempts(key) {
  attempts.delete(key);
}
var COMMON_PASSWORDS = /* @__PURE__ */ new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "11111111",
  "iloveyou",
  "sunshine",
  "letmein1",
  "admin123"
]);
function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (password.length > 128) return "Password too long";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "This password is too common \u2014 choose another";
  return null;
}

// src/tests/security.test.ts
test("safeEqual matches equal strings and rejects different ones", () => {
  assert.equal(safeEqual("secret-token", "secret-token"), true);
  assert.equal(safeEqual("secret-token", "secret-tokeN"), false);
  assert.equal(safeEqual("", "x"), false);
  assert.equal(safeEqual("short", "a-much-longer-string"), false);
});
test("password policy enforces length and blocks common passwords", () => {
  assert.equal(validatePassword("Str0ng-enough!"), null);
  assert.notEqual(validatePassword("short"), null);
  assert.notEqual(validatePassword("password123"), null);
  assert.notEqual(validatePassword("PASSWORD123"), null);
  assert.notEqual(validatePassword(12345678), null);
  assert.notEqual(validatePassword("x".repeat(200)), null);
});
test("failed-attempt tracker locks after 5 tries and clears on success", () => {
  const key = "test:lockout";
  clearAttempts(key);
  assert.equal(isLockedOut(key), false);
  for (let i = 0; i < 4; i++) {
    const r = recordFailedAttempt(key);
    assert.equal(r.locked, false);
  }
  const fifth = recordFailedAttempt(key);
  assert.equal(fifth.locked, true);
  assert.equal(isLockedOut(key), true);
  clearAttempts(key);
  assert.equal(isLockedOut(key), false);
});
