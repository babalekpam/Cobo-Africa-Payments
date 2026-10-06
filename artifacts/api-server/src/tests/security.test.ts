import { test } from "node:test";
import assert from "node:assert/strict";
import { safeEqual, validatePassword } from "../lib/security.js";

test("safeEqual matches equal strings and rejects different ones", () => {
  assert.equal(safeEqual("secret-token", "secret-token"), true);
  assert.equal(safeEqual("secret-token", "secret-tokeN"), false);
  assert.equal(safeEqual("", "x"), false);
  // different lengths must not throw (hashed before compare)
  assert.equal(safeEqual("short", "a-much-longer-string"), false);
});

test("password policy enforces length and blocks common passwords", () => {
  assert.equal(validatePassword("Str0ng-enough!"), null);
  assert.notEqual(validatePassword("short"), null);
  assert.notEqual(validatePassword("password123"), null);
  assert.notEqual(validatePassword("PASSWORD123"), null); // case-insensitive blocklist
  assert.notEqual(validatePassword(12345678 as unknown as string), null); // non-string
  assert.notEqual(validatePassword("x".repeat(200)), null); // absurd length
});

// The failed-attempt lockout is now database-backed: see tests/durableState.int.test.ts.
