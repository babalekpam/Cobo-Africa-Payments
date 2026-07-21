---
name: COBO fake/seed data cleanup
description: Where the platform's "fake data" comes from and how dev vs prod databases differ when cleaning it.
---

# COBO fake/seed data

New-account registration is already clean: it creates only zero-balance wallets + one "Welcome to COBO!" notification, no transactions. The "data" users see is on the **admin account (the admin account)**, not new accounts.

Sources of fake data differ by environment:
- **Dev**: `seed.ts` populated it — 80 sample transactions (`description LIKE 'Payment from COBO platform - transaction %'`), 6 named sample merchants, inflated admin wallet balances, 2 fake admin notifications.
- **Prod (cob-o.com)**: had NO seed.ts data. Instead it held the admin's own manual test data ("Sandbox wallet funding" deposits + a couple sends) and small admin wallet balances. A real user  existed and was already clean.

**Why this matters:** dev and prod accumulate fake data differently. Never blindly wipe prod tables — identify rows by signature (seed description pattern, known merchant names, or scope to the admin test account) and preserve real users.

**seed.ts is now minimal:** admin user + zero-balance wallets only. No merchants/transactions/balances/notifications seeded, so re-seeding stays clean.
