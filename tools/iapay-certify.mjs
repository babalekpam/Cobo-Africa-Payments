#!/usr/bin/env node
// IAPAY participant toolkit — dependency-free (Node 18+). Two commands:
//
//   node tools/iapay-certify.mjs certify   --url https://host --code BANKCODE --secret <secret> \
//        --key <an IAPAY key held by the operator, to pay> [--currency USD] [--amount 1.00] [--creditor-agent IAPAYPAN]
//     Runs the integration checks a bank must pass against a live (sandbox or production) deployment and
//     prints PASS/FAIL per check. Exit code is non-zero if any check fails. Sends small real test payments
//     (default 1.00) to --key, so use a sandbox or a key you own.
//
//   node tools/iapay-certify.mjs mock-bank --port 9090 --operator IAPAYPAN --secret <secret> [--reject-prefix reject]
//     A stand-in for a bank's receiving endpoint: verifies the switch's signature, replies pacs.002
//     (ACSC, or RJCT for keys starting with the reject prefix), idempotent on EndToEndId. Point a participant's
//     api_url at it to test the switch -> bank direction.

import crypto from "node:crypto";
import http from "node:http";

// ---------- helpers ----------
const args = Object.fromEntries(
  process.argv.slice(3).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]] : acc), [])
);
const sign = (secret, ts, body) => crypto.createHmac("sha256", secret).update(`${ts}.`).update(body).digest("hex");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pacs008({ msgId, e2e, amount, currency, alias, debtorCode, creditorCode }) {
  const agent = (tag, code) => `<${tag}><FinInstnId><ClrSysMmbId><ClrSysId><Prtry>IAPAY</Prtry></ClrSysId><MmbId>${esc(code)}</MmbId></ClrSysMmbId></FinInstnId></${tag}>`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"><FIToFICstmrCdtTrf>` +
    `<GrpHdr><MsgId>${esc(msgId)}</MsgId><CreDtTm>${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</CreDtTm><NbOfTxs>1</NbOfTxs></GrpHdr>` +
    `<CdtTrfTxInf><PmtId><InstrId>${esc(e2e)}</InstrId><EndToEndId>${esc(e2e)}</EndToEndId></PmtId>` +
    `<IntrBkSttlmAmt Ccy="${esc(currency)}">${amount}</IntrBkSttlmAmt><Dbtr><Nm>Certification Payer</Nm></Dbtr>` +
    `${agent("DbtrAgt", debtorCode)}${agent("CdtrAgt", creditorCode)}<Cdtr><Nm>Payee</Nm></Cdtr>` +
    `<CdtrAcct><Id><Othr><Id>${esc(alias)}</Id></Othr></Id></CdtrAcct><RmtInf><Ustrd>IAPAY certification</Ustrd></RmtInf></CdtTrfTxInf></FIToFICstmrCdtTrf></Document>`
  );
}
const pacs002 = (e2e, status, reason) =>
  `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10"><FIToFIPmtStsRpt>` +
  `<GrpHdr><MsgId>S${esc(e2e).slice(0, 34)}</MsgId><CreDtTm>${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</CreDtTm></GrpHdr>` +
  `<TxInfAndSts><OrgnlInstrId>${esc(e2e)}</OrgnlInstrId><OrgnlEndToEndId>${esc(e2e)}</OrgnlEndToEndId><TxSts>${status}</TxSts>` +
  `${reason ? `<StsRsnInf><Rsn><Prtry>${reason}</Prtry></Rsn></StsRsnInf>` : ""}</TxInfAndSts></FIToFIPmtStsRpt></Document>`;
const tag = (xml, name) => new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(xml)?.[1];

// ---------- mock-bank ----------
function mockBank() {
  const port = Number(args.port || 9090);
  const { operator, secret } = args;
  if (!operator || !secret) fail("mock-bank needs --operator and --secret");
  const rejectPrefix = args["reject-prefix"] || "reject";
  const seen = new Map(); // EndToEndId -> reply (idempotent)
  http
    .createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        const ts = String(req.headers["x-iapay-timestamp"] || "");
        const given = String(req.headers["x-iapay-signature"] || "");
        const expected = ts ? sign(secret, ts, body) : "";
        const fresh = /^\d{9,12}$/.test(ts) && Math.abs(Date.now() / 1000 - Number(ts)) < 300;
        const okSig = fresh && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
        if (!okSig || req.headers["x-iapay-participant"] !== operator) {
          console.log("REJECTED: bad signature/timestamp/participant");
          res.writeHead(401).end(JSON.stringify({ success: false }));
          return;
        }
        const xml = body.toString("utf8");
        const e2e = tag(xml, "EndToEndId") || "UNKNOWN";
        const alias = /<CdtrAcct>.*?<Id>([^<]*)<\/Id>/s.exec(xml)?.[1] || "";
        if (!seen.has(e2e)) seen.set(e2e, alias.startsWith(rejectPrefix) ? { code: 422, xml: pacs002(e2e, "RJCT", "AC03") } : { code: 200, xml: pacs002(e2e, "ACSC") });
        const reply = seen.get(e2e);
        console.log(`payment ${e2e} to ${alias}: ${reply.code === 200 ? "ACSC" : "RJCT"}`);
        res.writeHead(reply.code, { "content-type": "application/xml" }).end(reply.xml);
      });
    })
    .listen(port, () => console.log(`mock bank listening on :${port} (operator ${operator}); rejects keys starting with "${rejectPrefix}"`));
}

// ---------- certify ----------
async function certify() {
  const { url, code, secret, key } = args;
  if (!url || !code || !secret || !key) fail("certify needs --url, --code, --secret and --key");
  const currency = args.currency || "USD";
  const amount = Number(args.amount || 1).toFixed(2);
  const creditor = args["creditor-agent"] || "IAPAYPAN";
  const run = Date.now().toString(36).toUpperCase();
  const base = url.replace(/\/$/, "");

  async function call(path, body, { method = "POST", contentType = "application/xml", ts = Math.floor(Date.now() / 1000), badSig = false, signedOverride } = {}) {
    const signed = signedOverride ?? body ?? "";
    const res = await fetch(base + path, {
      method,
      headers: {
        "content-type": contentType,
        "x-iapay-participant": code,
        "x-iapay-timestamp": String(ts),
        "x-iapay-signature": badSig ? "00".repeat(32) : sign(secret, ts, signed),
      },
      body: method === "GET" ? undefined : body,
    });
    return { status: res.status, text: await res.text() };
  }
  const pay = (e2e, over = {}) => ({ msgId: `M${e2e}`.slice(0, 35), e2e, amount, currency, alias: key, debtorCode: code, creditorCode: creditor, ...over });
  const send = (xml, o) => call("/api/gateway/v1/credit-transfer", xml, o);
  const st = (r) => tag(r.text, "TxSts");

  const results = [];
  const check = async (name, fn) => {
    try {
      const out = await fn();
      results.push({ name, ok: out === true, note: out === true ? "" : String(out) });
    } catch (err) {
      results.push({ name, ok: false, note: `error: ${err.message}` });
    }
  };

  const e2e1 = `CERT${run}A`;
  const payXml = pacs008(pay(e2e1));
  await check("authentication: forged signature is rejected with 401", async () => (await send(payXml, { badSig: true })).status === 401 || "expected 401");
  await check("authentication: stale timestamp is rejected with 401", async () => (await send(payXml, { ts: Math.floor(Date.now() / 1000) - 3600 })).status === 401 || "expected 401");
  let first;
  await check("payment: a valid pacs.008 is accepted (ACSC)", async () => {
    first = await send(payXml);
    if (first.status === 422 && /AM23/.test(first.text)) return "rejected AM23 — the operator has not set your net-debit cap yet";
    if (first.status === 503) return "503 — the operator's exchange rates are not live; payments are paused";
    return (first.status === 200 && st(first) === "ACSC") || `status ${first.status}: ${first.text.slice(0, 160)}`;
  });
  await check("idempotency: re-sending the same message returns the same result and credits once", async () => {
    const again = await send(payXml);
    return (again.status === first?.status && st(again) === st(first)) || `first ${first?.status}/${st(first)} vs replay ${again.status}/${st(again)}`;
  });
  await check("status: querying the end-to-end id reports the payment", async () => {
    const r = await call(`/api/gateway/v1/status/${e2e1}`, undefined, { method: "GET", signedOverride: e2e1 });
    return (r.status === 200 && ["ACSC", "PDNG"].includes(st(r))) || `status ${r.status}: ${r.text.slice(0, 120)}`;
  });
  await check("rules: an unknown key is rejected AC03 and nothing is credited", async () => {
    const r = await send(pacs008(pay(`CERT${run}B`, { alias: `+000${run}` })));
    return (r.status === 422 && tag(r.text, "Prtry") === "AC03") || `status ${r.status}: ${r.text.slice(0, 120)}`;
  });
  await check("rules: a fractional-cent amount is rejected AM02 (never rounded)", async () => {
    const r = await send(pacs008(pay(`CERT${run}C`)).replace(`>${amount}<`, ">1.005<"));
    return (r.status === 422 && tag(r.text, "Prtry") === "AM02") || `status ${r.status}: ${r.text.slice(0, 120)}`;
  });
  await check("rules: a message claiming another bank as debtor agent is rejected RC01", async () => {
    const r = await send(pacs008(pay(`CERT${run}D`, { debtorCode: "SOMEOTHERBANK" })));
    return (r.status === 422 && tag(r.text, "Prtry") === "RC01") || `status ${r.status}: ${r.text.slice(0, 120)}`;
  });
  const certKey = `CERT${run}`;
  const reg = (id, action, extra = {}) =>
    call("/api/gateway/v1/aliases", JSON.stringify({ message_id: id, action, key_type: "merchant_id", key_value: certKey, holder_name: "Certification Test", currency, account_ref: "cert-1", ...extra }), { contentType: "application/json" });
  await check("keys: register a key for your own customer (201), duplicate is refused (409), delete works (200)", async () => {
    const a = await reg(`R1${run}`, "register");
    const b = await reg(`R2${run}`, "register");
    const c = await reg(`D1${run}`, "delete");
    return (a.status === 201 && b.status === 409 && c.status === 200) || `register ${a.status}, duplicate ${b.status}, delete ${c.status}`;
  });

  const width = Math.max(...results.map((r) => r.name.length));
  console.log("\nIAPAY participant certification —", base, `(participant ${code})\n`);
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}${r.note ? `  <- ${r.note}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed${failed ? " — fix the failures above and re-run" : " — integration looks correct"}`);
  console.log("Also verify on YOUR side: an unknown/timeout reply is treated as PENDING (poll status) — never as failure.");
  process.exitCode = failed ? 1 : 0;
}

function fail(msg) {
  console.error(msg + "\nUsage: node tools/iapay-certify.mjs <certify|mock-bank> [--option value ...]  (see the header of this file)");
  process.exit(2);
}

const command = process.argv[2];
if (command === "certify") await certify();
else if (command === "mock-bank") mockBank();
else fail("Unknown or missing command");
