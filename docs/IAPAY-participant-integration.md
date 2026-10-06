# IAPAY Participant Integration Guide

For a bank, mobile-money operator or PSP joining an IAPAY scheme, and for the operator onboarding them.
The scheme is country-agnostic: whoever deploys it configures their own name, operator institution, currencies and limits (section 7).

> **Status.** The gateway below is implemented and covered by unit tests and by integration tests against a real PostgreSQL. It has **not** had an independent penetration test, a formal security certification, or regulator approval. Do not move real customer funds through any deployment until those are done (section 9).

## 1. What a participant does

| You want to… | You call | You get |
|---|---|---|
| Let your customer **receive** by phone/email/ID | `POST /api/gateway/v1/aliases` (register) | the key resolves to your institution network-wide |
| **Send** to any key in the network | `POST /api/gateway/v1/credit-transfer` (pacs.008) | pacs.002: `ACSC` credited, `RJCT` refused, `PDNG` not final yet |
| Learn what happened to a payment | `GET /api/gateway/v1/status/{endToEndId}` | pacs.002 with the current state |
| **Receive** a payment for your customer | *you expose an HTTPS endpoint* (the switch POSTs a signed pacs.008 to your `apiUrl`) | you answer with pacs.002 |

The switch routes by key: if the recipient key is held by the operator it credits the operator's wallet; if it is held by another bank it forwards your pacs.008 to that bank and relays the answer.

## 2. Authentication — every request, both directions

Headers: `X-IAPAY-Participant` (your code, `[A-Z0-9]{3,20}`), `X-IAPAY-Timestamp` (Unix seconds), `X-IAPAY-Signature`.

```
signature = hex( HMAC_SHA256( sharedSecret, "<timestamp>." + <exact request bytes> ) )
```

* Sign the **exact bytes** you send. For `GET /status/{id}` the signed bytes are the end-to-end id string.
* The timestamp must be within ±300 s of the switch clock (`GATEWAY_MAX_CLOCK_SKEW_SEC`); keep clocks NTP-synchronised.
* Any authentication failure returns an identical `401 {"success":false,"message":"Unauthorized"}`. There is no hint about why.
* The shared secret is at least 16 characters; generate 32+ random bytes. Store it in a secrets manager, rotate it on a schedule and on any suspicion of exposure. Put the gateway behind mTLS or an IP allow-list at your edge as a second layer.

Node example:

```js
const crypto = require("crypto");
function sign(secret, body) {
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.`).update(body).digest("hex");
  return { "x-iapay-participant": "MYBANKKEN", "x-iapay-timestamp": String(ts), "x-iapay-signature": sig };
}
```

The switch signs its calls to you the same way (it sends `X-IAPAY-Participant: IAPAYPAN` — the operator's code — and your own shared secret). **Verify the signature and the timestamp window before parsing anything.**

## 3. Sending a payment (pacs.008)

`POST /api/gateway/v1/credit-transfer`, `Content-Type: application/xml`, body ≤ 256 KB, one `CdtTrfTxInf` per message.

Required content (ISO 20022 `pacs.008.001.08`): `GrpHdr/MsgId`; `PmtId/InstrId` and `PmtId/EndToEndId`; `IntrBkSttlmAmt` with `Ccy`; debtor name; `DbtrAgt` and `CdtrAgt` member ids (`ClrSysMmbId/MmbId`); and the recipient **IAPAY key** in `CdtrAcct/Id/Othr/Id`. Ids are `[A-Za-z0-9._-]{1,35}`.

Rules the switch enforces (each failure returns `422` with a pacs.002 `RJCT` and the reason code; nothing moves):

| Rule | Reason |
|---|---|
| `DbtrAgt` must equal your authenticated participant code | `RC01` |
| `CdtrAgt` must be the institution that actually holds the key | `RC01` |
| Key must exist and be active | `AC03` |
| Currency must equal the key's currency (**you** convert FX; the switch does not guess) | `AM03` |
| Amount > 0, at most 2 decimals (never silently rounded), within the single-payment ceiling | `AM02` |
| Your unsettled net debit + this payment must stay within **your net-debit cap** (default 0 until the operator sets it) | `AM23` |
| Debtor and creditor sanctions screening | `RR04` |
| Your participant record must be active | `AG01` |
| Recipient bank unreachable (nothing reserved or sent) | `AC13` |
| End-to-end id already used anywhere in the network | `DUPL` |

### 3.1 The rule that protects your money: UNKNOWN is not failure

You will get one of:

* `200` + `TxSts ACSC` — the recipient was credited. Final.
* `422` + `RJCT` — definitely **not** credited. Final. Release your customer's funds.
* `202`/`409`/`5xx`/timeout/connection reset/`TxSts PDNG` — **outcome unknown.** Do **not** release or re-debit. Keep the customer's funds reserved and poll `GET /status/{endToEndId}` until you get `ACSC` or `RJCT`. Resending the same message is always safe (below).

### 3.2 Idempotency

`(your code, MsgId)` is unique. Resending the same message (same `MsgId`, same `EndToEndId`) returns the current result and never moves money twice. Re-using a `MsgId` for a different payment returns `RJCT DUPL`. Never reuse a `MsgId` or `EndToEndId` for a new payment.

## 4. Registering keys for your customers

`POST /api/gateway/v1/aliases`, `Content-Type: application/json`:

```json
{ "message_id": "REG-001", "action": "register", "key_type": "phone",
  "key_value": "+233200000001", "holder_name": "Kofi Mensah",
  "currency": "GHS", "account_ref": "acct-001" }
```

`key_type`: `phone | email | national_id | merchant_id`. `action`: `register | delete`. `message_id` makes the call idempotent.
Responses: `201` registered, `409` already taken, `404` delete of a key you do not hold, `400` invalid.

**Your obligation:** verify that the customer owns the phone/email/ID (OTP or equivalent) **before** you register it. The switch trusts your assertion — that is the participation contract. You can only register and delete your own keys.

## 5. Receiving payments (your endpoint)

The switch `POST`s a signed pacs.008 (same format as above, one transaction) to your configured `apiUrl` over HTTPS and expects, within `GATEWAY_TIMEOUT_MS` (default 8 s):

* `200` + pacs.002 `ACSC` — you credited the customer's account (irrevocably, in your core).
* `200` or `4xx` + pacs.002 `RJCT` with an ISO reason — you did not and will not credit.
* anything else (or no answer) is treated by the switch as **unknown** and the payment is held for the operator to reconcile with you. So: be idempotent on `EndToEndId` (a retry or reconciliation query must never credit twice), and make sure your `ACSC` is only sent after your ledger commit.

Echo the original `EndToEndId` in `OrgnlEndToEndId`; a reply for a different id is treated as unknown.

## 6. Operator runbook

**Onboard a bank**

All of this is done through the operator (admin) API — no SQL, no environment edit, no restart. See `docs/IAPAY-deployment.md` section 2 for the exact commands.

1. `POST /api/scheme/participants` with the bank's `code` (`[A-Z0-9]{3,20}`), name, type, country, currency, its HTTPS receive endpoint (`api_url`) and its **net-debit cap**. The response contains the bank's **gateway secret exactly once** (stored AES-256-GCM encrypted; never shown again). Until a cap is set the bank cannot originate any payment (default cap 0). Size the cap to the settlement collateral or prefunding the bank has posted.
2. Hand the secret to the bank over a secure channel. Adjust later with `PUT /api/scheme/participants/{code}` (cap, endpoint, `status: suspended|active`) and `POST .../rotate-secret` (the old secret stops working immediately).
3. Run the bank's certification: `node tools/iapay-certify.mjs certify ...` (signatures, payment, replay, status, rejections, key registration). Separately exercise the timeout path (answer after 10 s) and confirm the bank polls status instead of retrying a new payment. `tools/iapay-certify.mjs mock-bank` provides a stand-in endpoint to test the switch-to-bank direction.
4. (Optional, legacy) secrets can still be supplied through `GATEWAY_PARTICIPANT_SECRETS`; a secret stored by the API takes precedence.

**Reconcile unresolved payments.** A payment whose bank outcome is unknown stays `unresolved` with the sender's money held. It is never refunded automatically (the bank may have credited).

* `GET /api/scheme/unresolved` (admin) lists them.
* Confirm with the bank what happened, then `POST /api/scheme/transfers/{reference}/resolve` with `{"outcome":"credited"|"not_credited","note":"<bank confirmation reference>"}`. It can be resolved exactly once; a second call returns `409`. `not_credited` refunds the sender; `credited` clears it into settlement. Every resolution is written to the audit log.
* A background sweeper parks any transfer stuck `pending` for more than 10 minutes (process crash mid-flight) as `unresolved`.

**Monitor:** alert on any `unresolved` row, on `AM23` rejections (a bank at its cap), on authentication-failure spikes, and on `gateway_messages` rows stuck in `received`.

## 7. Deployment configuration (country-agnostic)

| Variable | Meaning | Default |
|---|---|---|
| `SCHEME_NAME` | brand shown by the deployment | `IAPAY` |
| `SCHEME_HOME_PARTICIPANT_NAME` / `_COUNTRY` / `_CURRENCY` | the operator institution | `IAPAY (Intra-African Payments)` / `KE` / `USD` |
| `SCHEME_SEED_DEMO_PARTICIPANTS` | `false` for any real deployment (no fictional members) | `true` |
| `GATEWAY_PARTICIPANT_SECRETS` | `{"BANKCODE":"secret ≥16 chars",…}` | none (no participant can authenticate) |
| `GATEWAY_DEFAULT_NET_DEBIT_CAP_USD` | cap for banks with none set | `0` (fail closed) |
| `GATEWAY_MAX_SINGLE_AMOUNT_USD` | per-payment ceiling | `10000` |
| `GATEWAY_TIMEOUT_MS` / `GATEWAY_MAX_CLOCK_SKEW_SEC` | outbound timeout / signature window | `8000` / `300` |
| `EXCHANGERATE_API_KEY` | live FX rates (**required in production**; otherwise built-in static rates are used) | unset |

## 8. Security properties and their limits

Implemented and tested: HMAC authentication over exact bytes with a replay window; identical failure responses; idempotency ledger committed atomically with the credit; single-winner state transitions (no double credit/refund); per-bank net-debit cap under a database lock; fail-closed defaults; no bank call inside a database transaction; redirect-refusing, timeout-bounded outbound calls with HTTPS required in production; hardened XML parsing (size cap, DOCTYPE/ENTITY rejected, strict amount/currency validation); sanctions screening on real names; audit log for operator resolutions.

Known limits to close before production (also section 9): the HMAC window alone does not stop an attacker who can capture a *live* message from re-sending it within 5 minutes — this is safe for payments (the idempotency ledger returns the stored answer) but the switch does not yet record signature nonces; secrets are environment variables (no HSM/KMS, no per-participant rotation schedule); in-memory limiters/lockouts are per-instance; DNS-rebinding is not blocked at the application layer (use egress rules); sanctions matching is a stopgap, not a licensed list provider.

### 8.1 Independent review (adversarial, same branch)

A separate reviewer attacked the money path. **Fixed and regression-tested:** sub-cent amounts that debited nothing but credited converted money (critical — also present in the original home-to-home path); a concurrent double-return that refunded twice; numeric "national-id" keys shadowing phone numbers typed without `+`; duplicate wallets created by concurrent first credits; concurrent settlement runs double-applying balances; a late bank `ACSC` after an operator refund being dropped silently (now an audit-logged reconciliation alert); an SSRF-guard false positive that blocked real bank hostnames such as `fcmb.com`; the operator's own code being usable as an external sender; unbounded bank free text and bank reply size; alias message ids replaying success for a different request body; missing indexes on the exposure scan.

**Open — decide/close before real money:**

* Exposure drops out of the cap when a batch is marked `settled`, even though no money has actually moved between settlement accounts. A bank that never pays its net could originate up to its cap again each cycle. Tie "settled" to confirmed funds (and count an unpaid settlement balance as exposure).
* Exposure is computed by loading unsettled rows under the participant lock (now indexed). At high volume replace it with a SQL `SUM`.
* A bank's `pacs.002` reply is trusted on TLS alone (no response signature). The shared secret is symmetric and used in both directions, so a bank could forge switch-signed requests; prefer asymmetric signatures (mTLS client certificates or JWS).
* A bank can register any phone/email/ID key before its real owner does; only the participation contract (and, later, a verification attestation) stops this. `end_to_end_id` is unique network-wide, so a bank can pre-use ids (the `DUPL` reply is an oracle); consider scoping ids to the sender.
* Signatures are not bound to method or path (safe today because the ledger is idempotent and the status route is read-only); a missing-secret 401 returns slightly faster than a bad-signature 401.
* `/api/scheme/pay` idempotency is an in-memory map (lost on restart, not shared across instances, absent without an `Idempotency-Key`), and the daily-limit check is not atomic. Other rails (`/transfers/*`) have the same amount-precision and limit patterns and were **not** audited in this change.
* A cleared-but-unsettled transfer that is later returned is marked `returned`, so settlement nets the return leg but not the original.
* Sanctions screening is a stopgap: ≥2-word names, ASCII only, short hardcoded list, no creditor-name screening on bank-supplied names. Use a licensed provider with transliteration and fuzzy/subset matching.
* DNS rebinding is not blocked in the application; enforce egress rules.
* Exchange rates fall back to static values if `EXCHANGERATE_API_KEY` is unset; a stale rate misstates exposure and FX. Fail closed on stale rates in production.
* Operator resolution has no four-eyes approval or evidence attachment, and `unresolved` rows are not auto-polled via `pacs.028`.

## 9. Required before real money

Independent penetration test and code audit · SOC 2 / ISO 27001 programme · licensed sanctions-screening provider · HSM/KMS-managed keys and mTLS · settlement account/collateral arrangements and legal participation agreement (rulebook, liability, dispute rules) · regulator approval for operating a payment scheme/switch in each country · load and failure testing at target volume · high-availability, backup and disaster-recovery design · a monitored on-call process for `unresolved` payments.
