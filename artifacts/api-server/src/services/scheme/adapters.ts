// Participant adapters — how the switch hands a payment to an institution that
// holds the recipient's account. This is the plug-in point for a bank: it
// implements the HTTP contract below (signed pacs.008 in, pacs.002 out) and the
// switch needs no bank-specific code.
//
//   HttpBankAdapter  → production: POSTs a signed pacs.008 to the participant's apiUrl
//   MockBankAdapter  → sandbox/demo/certification: deterministic accept/reject rules
//
// Outcome semantics matter for money: ACSC = credited, RJCT = definitely not
// credited, UNKNOWN = timeout/transport failure (the switch must NOT assume either).

import { buildPacs008, type Iso20022Transfer } from "./iso20022.js";
import { parsePacs002, Iso20022ParseError } from "./iso20022Parse.js";
import { SIGNATURE_HEADERS, signMessage } from "./gateway/signing.js";

export type CreditStatus = "ACSC" | "RJCT" | "UNKNOWN";

export interface CreditResult {
  status: CreditStatus;
  /** ISO external status reason (e.g. AC03 invalid account) or a local diagnostic for UNKNOWN. */
  reason?: string;
}

export interface ParticipantAdapter {
  readonly code: string;
  sendCreditTransfer(transfer: Iso20022Transfer): Promise<CreditResult>;
}

export interface HttpBankAdapterOptions {
  /** Participant code of the *operator* — sent so the bank knows which secret to use. */
  operatorCode: string;
  participantCode: string;
  url: string;
  secret: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class HttpBankAdapter implements ParticipantAdapter {
  readonly code: string;
  constructor(private readonly opts: HttpBankAdapterOptions) {
    this.code = opts.participantCode;
  }

  async sendCreditTransfer(transfer: Iso20022Transfer): Promise<CreditResult> {
    const body = buildPacs008(transfer);
    const ts = Math.floor((this.opts.now?.() ?? Date.now()) / 1000);
    const doFetch = this.opts.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await doFetch(this.opts.url, {
        method: "POST",
        redirect: "error", // never follow redirects to another host
        headers: {
          "content-type": "application/xml",
          [SIGNATURE_HEADERS.participant]: this.opts.operatorCode,
          [SIGNATURE_HEADERS.timestamp]: String(ts),
          [SIGNATURE_HEADERS.signature]: signMessage(this.opts.secret, ts, body),
        },
        body,
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });
    } catch (err) {
      return { status: "UNKNOWN", reason: err instanceof Error ? err.name : "transport_error" };
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      // 4xx with a pacs.002 body is a definite business rejection; anything else is unknown.
      if (res.status >= 400 && res.status < 500) {
        try {
          const parsed = parsePacs002(text);
          if (parsed.status === "RJCT" && parsed.originalEndToEndId === transfer.endToEndId) {
            return { status: "RJCT", reason: parsed.reason ?? "NARR" };
          }
        } catch {
          /* fall through */
        }
      }
      return { status: "UNKNOWN", reason: `http_${res.status}` };
    }

    try {
      const parsed = parsePacs002(text);
      if (parsed.originalEndToEndId !== transfer.endToEndId) return { status: "UNKNOWN", reason: "e2e_mismatch" };
      if (parsed.status === "ACSC") return { status: "ACSC" };
      if (parsed.status === "RJCT") return { status: "RJCT", reason: parsed.reason ?? "NARR" };
      return { status: "UNKNOWN", reason: `status_${parsed.status}` };
    } catch (err) {
      return { status: "UNKNOWN", reason: err instanceof Iso20022ParseError ? "bad_reply" : "reply_error" };
    }
  }
}

/** Deterministic stand-in for a bank: handy for sandboxes and for conformance tests. */
export class MockBankAdapter implements ParticipantAdapter {
  readonly calls: Iso20022Transfer[] = [];
  constructor(
    readonly code: string,
    private readonly rules: { rejectAliasPrefix?: string; unknownAliasPrefix?: string; maxAmount?: number } = {}
  ) {}

  async sendCreditTransfer(transfer: Iso20022Transfer): Promise<CreditResult> {
    this.calls.push(transfer);
    const alias = transfer.creditorAlias ?? "";
    if (this.rules.unknownAliasPrefix && alias.startsWith(this.rules.unknownAliasPrefix)) {
      return { status: "UNKNOWN", reason: "mock_timeout" };
    }
    if (this.rules.rejectAliasPrefix && alias.startsWith(this.rules.rejectAliasPrefix)) {
      return { status: "RJCT", reason: "AC03" }; // invalid creditor account
    }
    if (this.rules.maxAmount !== undefined && transfer.recipientAmount > this.rules.maxAmount) {
      return { status: "RJCT", reason: "AM02" }; // not allowed amount
    }
    return { status: "ACSC" };
  }
}
