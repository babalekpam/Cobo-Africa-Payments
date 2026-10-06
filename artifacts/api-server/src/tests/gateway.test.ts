import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { loadSchemeConfig, loadParticipantSecrets } from "../services/scheme/config.js";
import { signMessage, verifySignature, SIGNATURE_HEADERS } from "../services/scheme/gateway/signing.js";
import { parsePacs008, parsePacs002, Iso20022ParseError } from "../services/scheme/iso20022Parse.js";
import { buildPacs008, buildPacs002, type Iso20022Transfer } from "../services/scheme/iso20022.js";
import { HttpBankAdapter, MockBankAdapter } from "../services/scheme/adapters.js";

const transfer: Iso20022Transfer = {
  reference: "IAP-1",
  endToEndId: "EIAPAYPAN20261006AAAAAAAAAAA",
  amount: 5000,
  currency: "NGN",
  recipientAmount: 50,
  recipientCurrency: "GHS",
  fxRate: 0.01,
  initiatedAt: new Date("2026-10-06T10:00:00Z"),
  clearedAt: new Date("2026-10-06T10:00:01Z"),
  description: "Invoice 42",
  creditorAlias: "+233201234567",
  debtor: { name: "Ada Obi", participantCode: "IAPAYPAN", country: "KE" },
  creditor: { name: "Kofi A.", participantCode: "BANKGHA", country: "GH" },
};
const SECRET = "0123456789abcdef-shared-secret";

// ---- config ----
test("config defaults are country-neutral and overridable; bad values fall back", () => {
  const d = loadSchemeConfig({});
  assert.equal(d.name, "IAPAY");
  assert.equal(d.seedDemoParticipants, true);
  const c = loadSchemeConfig({ SCHEME_NAME: "NaijaPay", SCHEME_HOME_COUNTRY: "ng", SCHEME_HOME_CURRENCY: "ngn", SCHEME_SEED_DEMO_PARTICIPANTS: "false", GATEWAY_TIMEOUT_MS: "1500" });
  assert.deepEqual([c.name, c.homeCountry, c.homeCurrency, c.seedDemoParticipants, c.gatewayTimeoutMs], ["NaijaPay", "NG", "NGN", false, 1500]);
  const bad = loadSchemeConfig({ SCHEME_HOME_COUNTRY: "Nigeria", SCHEME_HOME_CURRENCY: "x", GATEWAY_TIMEOUT_MS: "-5" });
  assert.deepEqual([bad.homeCountry, bad.homeCurrency, bad.gatewayTimeoutMs], ["KE", "USD", 8000]);
});

test("participant secrets: valid JSON loads, short or malformed secrets are dropped (fail closed)", () => {
  assert.deepEqual(loadParticipantSecrets({ GATEWAY_PARTICIPANT_SECRETS: JSON.stringify({ A: SECRET, B: "short" }) }), { A: SECRET });
  assert.deepEqual(loadParticipantSecrets({ GATEWAY_PARTICIPANT_SECRETS: "{not json" }), {});
  assert.deepEqual(loadParticipantSecrets({ GATEWAY_PARTICIPANT_SECRETS: "[1,2]" }), {});
  assert.deepEqual(loadParticipantSecrets({}), {});
});

// ---- signing ----
test("signature verifies for the exact body and rejects tampering, staleness and garbage", () => {
  const now = 1_790_000_000;
  const body = "<x/>";
  const sig = signMessage(SECRET, now, body);
  const ok = (over: Partial<Parameters<typeof verifySignature>[0]> = {}) =>
    verifySignature({ secret: SECRET, timestamp: String(now), signature: sig, body, nowSec: now, ...over });
  assert.deepEqual(ok(), { ok: true });
  assert.deepEqual(ok({ body: "<y/>" }), { ok: false, reason: "bad_signature" });
  assert.deepEqual(ok({ secret: "another-secret-another-secret" }), { ok: false, reason: "bad_signature" });
  assert.deepEqual(ok({ nowSec: now + 301 }), { ok: false, reason: "stale" });
  assert.deepEqual(ok({ timestamp: "abc" }), { ok: false, reason: "bad_timestamp" });
  assert.deepEqual(ok({ signature: undefined }), { ok: false, reason: "missing_fields" });
  assert.deepEqual(ok({ signature: "zz" }), { ok: false, reason: "bad_signature" });
});

// ---- parsing ----
test("pacs.008 built by the switch parses back to the same facts", () => {
  const p = parsePacs008(buildPacs008(transfer));
  assert.equal(p.endToEndId, transfer.endToEndId);
  assert.equal(p.instrId, "IAP-1");
  assert.equal(p.amount, 50);
  assert.equal(p.currency, "GHS");
  assert.equal(p.creditorAlias, "+233201234567");
  assert.equal(p.debtorAgentCode, "IAPAYPAN");
  assert.equal(p.creditorAgentCode, "BANKGHA");
  assert.equal(p.remittance, "Invoice 42");
});

test("pacs.008 parser rejects hostile or malformed input", () => {
  const good = buildPacs008(transfer);
  assert.throws(() => parsePacs008(""), Iso20022ParseError);
  assert.throws(() => parsePacs008("<Document><nope/></Document>"), Iso20022ParseError);
  assert.throws(() => parsePacs008(good.replace("<Document", '<!DOCTYPE d [<!ENTITY x "y">]><Document')), /DOCTYPE/);
  assert.throws(() => parsePacs008("x".repeat(300 * 1024)), /too large/);
  assert.throws(() => parsePacs008(good.replace(">50.00<", ">-5<")), /Invalid amount/);
  assert.throws(() => parsePacs008(good.replace(">50.00<", ">0.00<")), /positive/);
  assert.throws(() => parsePacs008(good.replace('Ccy="GHS"', 'Ccy="ghs"')), /currency/i);
  assert.throws(() => parsePacs008(good.replace(/<CdtrAcct>.*<\/CdtrAcct>/, "")), /creditor key/);
});

test("pacs.002 parser reads status, reason and original e2e id", () => {
  assert.deepEqual(parsePacs002(buildPacs002(transfer, "ACSC")), { status: "ACSC", reason: null, originalEndToEndId: transfer.endToEndId });
  assert.equal(parsePacs002(buildPacs002(transfer, "RJCT", "AC03")).reason, "AC03");
  assert.throws(() => parsePacs002(buildPacs008(transfer)), Iso20022ParseError);
});

// ---- adapters ----
type Handler = (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void;
async function withBank<T>(handler: Handler, fn: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => handler(req, body, res));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/credit`);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
const adapterFor = (url: string, timeoutMs = 2000) =>
  new HttpBankAdapter({ operatorCode: "IAPAYPAN", participantCode: "BANKGHA", url, secret: SECRET, timeoutMs });

test("HttpBankAdapter sends a correctly signed pacs.008 and maps ACSC", async () => {
  let verified: unknown;
  let parsedAlias = "";
  const result = await withBank(
    (req, body, res) => {
      verified = verifySignature({
        secret: SECRET,
        timestamp: req.headers[SIGNATURE_HEADERS.timestamp] as string,
        signature: req.headers[SIGNATURE_HEADERS.signature] as string,
        body,
      });
      assert.equal(req.headers[SIGNATURE_HEADERS.participant], "IAPAYPAN");
      parsedAlias = parsePacs008(body).creditorAlias;
      res.writeHead(200, { "content-type": "application/xml" }).end(buildPacs002(transfer, "ACSC"));
    },
    (url) => adapterFor(url).sendCreditTransfer(transfer)
  );
  assert.deepEqual(verified, { ok: true });
  assert.equal(parsedAlias, "+233201234567");
  assert.deepEqual(result, { status: "ACSC" });
});

test("HttpBankAdapter maps business rejection (200 or 4xx) to RJCT with the bank's reason", async () => {
  const rjct = buildPacs002(transfer, "RJCT", "AC04");
  for (const code of [200, 422]) {
    const r = await withBank((_q, _b, res) => void res.writeHead(code).end(rjct), (url) => adapterFor(url).sendCreditTransfer(transfer));
    assert.deepEqual(r, { status: "RJCT", reason: "AC04" });
  }
});

test("HttpBankAdapter never guesses: timeouts, 5xx, garbage and wrong e2e id are UNKNOWN", async () => {
  const slow = await withBank(() => {}, (url) => adapterFor(url, 150).sendCreditTransfer(transfer));
  assert.equal(slow.status, "UNKNOWN");
  const e5 = await withBank((_q, _b, res) => void res.writeHead(503).end("busy"), (url) => adapterFor(url).sendCreditTransfer(transfer));
  assert.deepEqual(e5, { status: "UNKNOWN", reason: "http_503" });
  const junk = await withBank((_q, _b, res) => void res.writeHead(200).end("not xml at all"), (url) => adapterFor(url).sendCreditTransfer(transfer));
  assert.equal(junk.status, "UNKNOWN");
  const other = await withBank(
    (_q, _b, res) => void res.writeHead(200).end(buildPacs002({ ...transfer, endToEndId: "EOTHER" }, "ACSC")),
    (url) => adapterFor(url).sendCreditTransfer(transfer)
  );
  assert.deepEqual(other, { status: "UNKNOWN", reason: "e2e_mismatch" });
  const down = await adapterFor("http://127.0.0.1:1/credit").sendCreditTransfer(transfer);
  assert.equal(down.status, "UNKNOWN");
});

test("HttpBankAdapter refuses to follow redirects (signed body must never reach another host)", async () => {
  let evilHits = 0;
  const evil = await withBank(
    (_q, _b, res) => {
      evilHits++;
      res.writeHead(200).end(buildPacs002(transfer, "ACSC")); // would be mistaken for acceptance if followed
    },
    async (evilUrl) =>
      withBank((_q, _b, res) => void res.writeHead(307, { location: evilUrl }).end(), (url) => adapterFor(url).sendCreditTransfer(transfer))
  );
  assert.equal(evil.status, "UNKNOWN");
  assert.equal(evilHits, 0);
});

test("MockBankAdapter rules are deterministic and record calls", async () => {
  const bank = new MockBankAdapter("BANKGHA", { rejectAliasPrefix: "+2330", unknownAliasPrefix: "+2331", maxAmount: 100 });
  assert.deepEqual(await bank.sendCreditTransfer({ ...transfer, creditorAlias: "+233201234567" }), { status: "ACSC" });
  assert.deepEqual(await bank.sendCreditTransfer({ ...transfer, creditorAlias: "+23301" }), { status: "RJCT", reason: "AC03" });
  assert.equal((await bank.sendCreditTransfer({ ...transfer, creditorAlias: "+23311" })).status, "UNKNOWN");
  assert.deepEqual(await bank.sendCreditTransfer({ ...transfer, recipientAmount: 500 }), { status: "RJCT", reason: "AM02" });
  assert.equal(bank.calls.length, 4);
});
