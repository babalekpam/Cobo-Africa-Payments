# IAPAY — Intra-African Payments: from aggregator to bank-grade scheme

*Working strategy document. Facts about the codebase were checked against the repo on 2026-10-06. Market and regulatory statements are directional and must be verified with counsel and local regulators before being used with a bank.*

## 1. The positioning shift

| Today (aggregator) | Target (scheme / network) |
|---|---|
| Wallets, payment links, checkout, mobile-money rails stitched together | A neutral **instant account-to-account network** that banks, mobile-money operators and fintechs join |
| IAPAY holds the customer balance | **Banks hold the accounts**; IAPAY routes messages, resolves aliases, clears and coordinates settlement |
| Value = product features | Value = **network of participants + licences + rulebook + proven volume** |

**Why the Zelle/Pix model fits.** Zelle works because the customer never leaves their own bank app: they pay a phone number or email, the money moves bank-to-bank in seconds, and it is free to the consumer. The banks pay for it. Pix did the same with central-bank backing. IAPAY already has the right primitives (alias directory, instant switch, QR, netting, returns/disputes). What it lacks is the bank-facing half.

**Where IAPAY sits relative to PAPSS.** PAPSS (Afreximbank) is existing intra-African settlement infrastructure. A bank will ask "why not just use PAPSS?" The honest answer to build on: PAPSS is wholesale bank-to-bank settlement; IAPAY is the **customer-facing overlay** (keys, QR, request-to-pay, disputes, merchant acceptance) that can settle *over* PAPSS or national RTGS rather than compete with it. Pursue that as a partnership, not a rivalry.

## 2. Honest gap assessment

**Already in the repo** (see `replit.md`): alias directory with OTP-verified keys; 24/7 switch with FX and OFAC screening; EMVCo-style QR with CRC-16; multilateral netting on a 4h cycle; returns and disputes; USSD; security hardening; 18 passing tests; and, new in this change, ISO 20022 `pacs.008` / `pacs.002` / `pacs.004` message generation plus `GET /api/scheme/transfers/:reference/iso20022` (`pacs.008` and `pacs.002` only; `pacs.004` is library-only so far).

**What a bank would find missing, in priority order:**

1. ~~Custodial ledger instead of bank accounts.~~ **Now supported.** Keys can be held by an external bank; the switch sends it a signed `pacs.008` and acts on the `pacs.002` (see `docs/IAPAY-participant-integration.md`). Wallet-to-wallet remains for operator-held accounts. What is still true: the 14 demo members in `participants.ts` are fictional (turn them off with `SCHEME_SEED_DEMO_PARTICIPANTS=false`), and **no real institution is connected or has signed anything**.
2. ~~No inbound participant API.~~ **Built:** HMAC-signed gateway (`/api/gateway/v1/*`) with replay ledger, status query and key registration. Still open: mTLS, per-participant secret rotation, HSM/KMS key custody.
3. **Settlement risk controls — partly built.** Per-participant **net-debit caps** (fail-closed default 0), a single-payment ceiling, and exposure that counts unsettled and unresolved payments are implemented. Still open: pre-funded settlement accounts / collateral management, and a real settlement leg (the switch still only computes net positions; no money moves between banks' settlement accounts).
4. **Single-instance state.** Idempotency cache and OTP/PIN lockout counters are in memory (noted in `replit.md`). Needs Redis or equivalent and a horizontally scalable, highly available deployment with disaster recovery.
5. **No fraud engine.** Only KYC limits and OFAC. Banks expect velocity checks, mule-account detection, device signals and name-check ("confirmation of payee") before the payment is released.
6. **No governance artefacts.** No scheme rulebook, participation agreement, fee schedule, liability rules or SLA definitions.
7. **No third-party assurance.** No penetration test, SOC 2 / ISO 27001, or documented data-residency approach per country.
8. **Sample-grade operations.** Single VPS deploy with password SSH, an admin email in `replit.md`, seed/fake-data cleanup notes. Fine for a pilot, not for a buyer's due diligence.

## 3. Roadmap in the order a bank evaluates

**Phase 0 — done in this change:** rebrand to IAPAY / Intra-African Payments; ISO 20022 outbound messages with tests.

**Phase 1 — Participant gateway (makes a bank pilot possible). Core built; operator self-service onboarding, encrypted secrets, a certification tool and one-command deployment added (see `docs/IAPAY-deployment.md`).**
Done: signed `pacs.008`/`pacs.002` endpoints, idempotent retry, status query, key registration, outbound `HttpBankAdapter` and a `MockBankAdapter`, integration tests against real PostgreSQL, operator reconciliation of unresolved payments. Still to do: mTLS and detached/rotating message keys; a name-verification ("confirmation of payee") call before release; `pacs.004` returns over the gateway; a self-service certification suite and sandbox portal a bank can run without the operator; load testing.

**Phase 2 — Risk and liquidity.**
Done: net-debit caps enforced before clearing. Still to do: pre-funding/collateral per participant; real-time position dashboard and alerts as a bank nears its cap; fraud scoring and a shared mule-account list across participants (a genuine network-effect advantage); request-to-pay (`pain.013/014`).

**Phase 3 — Settlement.**
Settlement via pre-funded accounts first, then PAPSS or national RTGS integration per corridor. FX at published scheme rates with participant-visible margins.

**Phase 4 — Governance and assurance.**
Rulebook, participation agreement, dispute rules, fee schedule; penetration test and SOC 2 / ISO 27001 programme; DR and multi-region runbooks; load test with published throughput and latency numbers.

## 4. What makes it *desired* by banks

- **Low integration cost:** one ISO 20022 adapter, a self-service certification suite, and a bank-branded SDK (white-label "Pay by phone/email" screen) they drop into their own app.
- **Revenue for them:** interchange-style fee share on merchant QR payments; no cost on person-to-person at first (Zelle/Pix model).
- **Risk they can defend to their regulator:** caps, prefunding, audit trail, sanctions screening at the switch, clear dispute liability.
- **Reach:** USSD and mobile-money participants give banks access to unbanked counterparties without building anything.

## 5. Selling to a bank — realistic shape

Code alone is worth little to an acquirer; they can build a switch. What they pay for is **licences, signed participants, live volume, and a clean, documented, auditable platform.** Two exit shapes:

1. **License/white-label the engine** to a bank, bank group or central bank as its domestic instant-payment hub. Faster and more realistic first sale; needs the Phase 1–2 items and a source-escrow/support package.
2. **Sell the network company** (entity + licences + participant contracts + volume). Higher value, needs 12–24 months of traction and a licence/sponsor-bank structure.

Prepare either way: a data room (architecture, security reports, rulebook, participant LOIs, volume metrics), IP assignment cleaned up (who authored what, third-party licences), and an entity structure a buyer can acquire.

Likely buyer types to approach: pan-African banks, payment processors, telco/mobile-money groups, development-finance institutions, and national payment-system operators. The first step is **one pilot with 2–3 institutions in 2 corridors**, not a broad pitch.

## 6. Branding and identity

- Name: **IAPAY — Intra-African Payments** ("intra" = within Africa). Previous docs said "Inter-Africa Pay"; all references are updated in this change.
- Domains checked 2026-10-06 (not registered by us): `iapay.com`, `iapay.io`, `iapay.app` are **taken**; `iapay.africa`, `iapay.co`, `iapay.org` and (premium-priced) `iapay.net` were **available**. Trademark search not done — required before investing further in the name.
- Infrastructure identifiers (`cobo-*` package/folder names, `cob-o.com` domain, `cobo-api` PM2 process, mobile bundle ID `com.cobo.africa`, support email `support@coboafrica.com`) were intentionally left unchanged; renaming them affects deployment, app-store identity and mail routing and should be a separate, planned migration.

## 7. Open decisions for the owner

1. **Target buyer / partner first:** a commercial bank, a mobile-money/telco group, or a central-bank/national switch?
2. **Pilot corridors and licensing route:** which two countries, and own licence vs. sponsor-bank/partner licence?
3. **Brand:** confirm "Intra-African Payments" as the official expansion and register the domain and trademark.
