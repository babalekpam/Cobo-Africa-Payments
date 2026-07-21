import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const KEY_TYPES = [
  { value: "phone", label: "📱 Phone number", hint: "+254712345678" },
  { value: "email", label: "✉️ Email address", hint: "you@example.com" },
  { value: "national_id", label: "🪪 National ID", hint: "ID / passport number" },
  { value: "merchant_id", label: "🏪 Merchant ID", hint: "Your merchant code" },
  { value: "random", label: "🎲 Random key", hint: "Auto-generated UUID" },
];

const CURRENCIES = [
  "USD", "NGN", "GHS", "KES", "ZAR", "TZS", "UGX", "ETB", "EGP", "RWF",
  "XOF", "XAF", "MAD", "CDF", "AOA", "MZN", "ZMW", "TND", "MWK", "EUR", "GBP",
];

interface AliasRow {
  id: number;
  aliasType: string;
  aliasValue: string;
  currency: string;
  status: string;
}

interface ResolvedKey {
  holder_name: string;
  alias_type: string;
  currency: string;
  institution: { code: string; name: string; country: string; type: string };
}

interface SchemeTransfer {
  id: number;
  reference: string;
  endToEndId: string;
  recipientAlias: string;
  amount: string;
  currency: string;
  recipientAmount: string;
  recipientCurrency: string;
  status: string;
  initiatedAt: string;
  senderUserId: number | null;
}

export default function AfriPay() {
  const { user, wallets, refreshWallets } = useAuth();
  const [tab, setTab] = useState<"pay" | "keys" | "receive" | "network">("pay");

  // Keys
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [newKeyType, setNewKeyType] = useState("phone");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyCurrency, setNewKeyCurrency] = useState("USD");
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Pay
  const [payKey, setPayKey] = useState("");
  const [resolved, setResolved] = useState<ResolvedKey | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payWalletId, setPayWalletId] = useState<number | null>(null);
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState<{ ok: boolean; text: string; ref?: string } | null>(null);

  // Receive
  const [qrKey, setQrKey] = useState("");
  const [qrAmount, setQrAmount] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  // Network
  const [participants, setParticipants] = useState<Array<{ id: number; code: string; name: string; type: string; country: string; currency: string; status: string }>>([]);
  const [stats, setStats] = useState<{ participants: number; countries: number; transfers: number; total_volume: number } | null>(null);
  const [transfers, setTransfers] = useState<SchemeTransfer[]>([]);

  useEffect(() => {
    loadAliases();
    api.get("/scheme/stats").then(({ data }) => setStats(data.stats)).catch(() => {});
    api.get("/scheme/participants").then(({ data }) => setParticipants(data.participants || [])).catch(() => {});
    api.get("/scheme/transfers").then(({ data }) => setTransfers(data.transfers || [])).catch(() => {});
  }, []);

  async function loadAliases() {
    try {
      const { data } = await api.get("/scheme/aliases");
      setAliases(data.aliases || []);
      if (data.aliases?.length && !qrKey) setQrKey(data.aliases[0].aliasValue);
    } catch { /* not fatal */ }
  }

  async function registerKey() {
    setKeyMsg(null);
    try {
      const { data } = await api.post("/scheme/aliases", {
        alias_type: newKeyType,
        alias_value: newKeyValue,
        currency: newKeyCurrency,
      });
      setKeyMsg({ ok: true, text: data.message || "Key registered" });
      setNewKeyValue("");
      loadAliases();
    } catch (e: any) {
      setKeyMsg({ ok: false, text: e.response?.data?.message || "Could not register key" });
    }
  }

  async function removeKey(id: number) {
    try {
      await api.delete(`/scheme/aliases/${id}`);
      loadAliases();
    } catch { /* ignore */ }
  }

  async function lookupKey() {
    setResolved(null);
    setResolveErr(null);
    setPayResult(null);
    if (!payKey.trim()) return;
    try {
      const { data } = await api.get(`/scheme/resolve?key=${encodeURIComponent(payKey.trim())}`);
      setResolved(data as ResolvedKey);
    } catch (e: any) {
      setResolveErr(e.response?.data?.message || "Key not found");
    }
  }

  async function sendPayment() {
    if (!resolved || !payAmount) return;
    setPaying(true);
    setPayResult(null);
    try {
      const { data } = await api.post("/scheme/pay", {
        key: payKey.trim(),
        amount: payAmount,
        wallet_id: payWalletId || undefined,
        description: payNote || undefined,
      });
      setPayResult({
        ok: true,
        text: `Sent instantly! ${data.recipient_currency} ${Number(data.recipient_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} delivered to ${data.recipient_name}.`,
        ref: data.reference,
      });
      setPayAmount("");
      setPayNote("");
      setResolved(null);
      setPayKey("");
      refreshWallets().catch(() => {});
      api.get("/scheme/transfers").then(({ data: d }) => setTransfers(d.transfers || [])).catch(() => {});
    } catch (e: any) {
      setPayResult({ ok: false, text: e.response?.data?.message || "Payment failed" });
    } finally {
      setPaying(false);
    }
  }

  async function generateQr() {
    setQrDataUrl(null);
    setQrPayload(null);
    try {
      const { data } = await api.post("/scheme/qr/generate", {
        key: qrKey || undefined,
        amount: qrAmount || undefined,
      });
      setQrDataUrl(data.dataUrl);
      setQrPayload(data.payload);
    } catch { /* handled by empty state */ }
  }

  useEffect(() => {
    if (tab === "receive" && aliases.length) generateQr();
  }, [tab, qrKey, qrAmount, aliases.length]);

  const typeBadge = (t: string) =>
    t === "bank" ? "🏦 Bank" : t === "mobile_money" ? "📱 Mobile Money" : t === "central_bank" ? "🏛️ Central Bank" : "💳 Fintech";

  return (
    <Layout>
      <div className="page fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>⚡ AfriPay</h1>
          <span className="badge" style={{ background: "#1B9E5A", color: "#fff" }}>Instant · 24/7 · Free</span>
        </div>
        <p style={{ color: "var(--text-dim)", marginBottom: "1.5rem" }}>
          The pan-African instant payment network. Send to any AfriPay key — phone, email, ID or merchant code —
          across {stats ? stats.countries : "many"} countries, settled between {stats ? stats.participants : ""} member institutions.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {([
            ["pay", "💸 Pay a key"],
            ["keys", "🔑 My keys"],
            ["receive", "📲 Receive (AfriQR)"],
            ["network", "🌍 Network"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "btn btn-primary" : "btn"}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pay" && (
          <div className="grid-2" style={{ alignItems: "start" }}>
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Send an instant payment</h3>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>AfriPay key</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Phone, email, national ID or merchant code"
                  value={payKey}
                  onChange={(e) => setPayKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupKey()}
                />
                <button className="btn" onClick={lookupKey}>Look up</button>
              </div>
              {resolveErr && <div style={{ color: "var(--red)", fontSize: "0.875rem", marginBottom: 12 }}>{resolveErr}</div>}

              {resolved && (
                <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Paying</div>
                  <div style={{ fontWeight: 700 }}>{resolved.holder_name}</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>
                    {resolved.institution.name} · {resolved.institution.country} · receives {resolved.currency}
                  </div>
                </div>
              )}

              {resolved && (
                <>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>From wallet</label>
                  <select
                    className="input"
                    style={{ width: "100%", marginBottom: 12 }}
                    value={payWalletId ?? ""}
                    onChange={(e) => setPayWalletId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Auto ({resolved.currency} preferred)</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.currency} — {Number(w.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Amount</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    style={{ width: "100%", marginBottom: 12 }}
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Note (optional)</label>
                  <input
                    className="input"
                    style={{ width: "100%", marginBottom: 16 }}
                    placeholder="What's it for?"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    disabled={paying || !payAmount || Number(payAmount) <= 0}
                    onClick={sendPayment}
                  >
                    {paying ? "Clearing…" : "Send instantly — no fee"}
                  </button>
                </>
              )}

              {payResult && (
                <div
                  style={{
                    marginTop: 12, padding: "0.75rem 1rem", borderRadius: 10, fontSize: "0.9rem",
                    background: payResult.ok ? "rgba(27,158,90,0.1)" : "rgba(217,54,54,0.08)",
                    color: payResult.ok ? "var(--green)" : "var(--red)",
                  }}
                >
                  {payResult.text}
                  {payResult.ref && <div style={{ fontSize: "0.75rem", marginTop: 4 }}>Ref: {payResult.ref}</div>}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Recent AfriPay activity</h3>
              {transfers.length === 0 ? (
                <div className="empty" style={{ padding: "2rem" }}>No instant payments yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {transfers.slice(0, 8).map((t) => {
                    const outgoing = t.senderUserId === user?.id;
                    return (
                      <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", background: "var(--surface2)", borderRadius: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                            {outgoing ? `→ ${t.recipientAlias}` : "← Received"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                            {new Date(t.initiatedAt).toLocaleString()} · {t.status}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: outgoing ? "var(--red)" : "var(--green)" }}>
                          {outgoing ? "−" : "+"}
                          {outgoing
                            ? `${t.currency} ${Number(t.amount).toLocaleString()}`
                            : `${t.recipientCurrency} ${Number(t.recipientAmount).toLocaleString()}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "keys" && (
          <div className="grid-2" style={{ alignItems: "start" }}>
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Register an AfriPay key</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Anyone on the network can pay you with just this key — no account numbers. Up to 5 keys.
              </p>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Key type</label>
              <select className="input" style={{ width: "100%", marginBottom: 12 }} value={newKeyType} onChange={(e) => setNewKeyType(e.target.value)}>
                {KEY_TYPES.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              {newKeyType !== "random" && (
                <>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Value</label>
                  <input
                    className="input"
                    style={{ width: "100%", marginBottom: 12 }}
                    placeholder={KEY_TYPES.find((k) => k.value === newKeyType)?.hint}
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                  />
                </>
              )}
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Receive currency</label>
              <select className="input" style={{ width: "100%", marginBottom: 16 }} value={newKeyCurrency} onChange={(e) => setNewKeyCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn btn-primary" style={{ width: "100%" }} onClick={registerKey}>Register key</button>
              {keyMsg && (
                <div style={{ marginTop: 12, fontSize: "0.875rem", color: keyMsg.ok ? "var(--green)" : "var(--red)" }}>{keyMsg.text}</div>
              )}
            </div>

            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>My keys ({aliases.length}/5)</h3>
              {aliases.length === 0 ? (
                <div className="empty" style={{ padding: "2rem" }}>No keys yet — register one to start receiving</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {aliases.map((a) => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", background: "var(--surface2)", borderRadius: 8 }}>
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", wordBreak: "break-all" }}>{a.aliasValue}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                          {KEY_TYPES.find((k) => k.value === a.aliasType)?.label || a.aliasType} · receives {a.currency}
                        </div>
                      </div>
                      <button className="btn" style={{ color: "var(--red)" }} onClick={() => removeKey(a.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "receive" && (
          <div className="card" style={{ padding: "2rem", maxWidth: 520 }}>
            <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Receive with AfriQR</h3>
            <p style={{ color: "var(--text-dim)", fontSize: "0.875rem", marginBottom: "1rem" }}>
              An EMV-standard QR any AfriPay member app can scan — like Pix's BR Code, for Africa.
            </p>
            {aliases.length === 0 ? (
              <div className="empty" style={{ padding: "2rem" }}>Register an AfriPay key first (My keys tab)</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Key</label>
                    <select className="input" style={{ width: "100%" }} value={qrKey} onChange={(e) => setQrKey(e.target.value)}>
                      {aliases.map((a) => <option key={a.id} value={a.aliasValue}>{a.aliasValue}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.875rem" }}>Amount (optional)</label>
                    <input className="input" type="number" min="0" style={{ width: "100%" }} placeholder="Any amount" value={qrAmount} onChange={(e) => setQrAmount(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem", background: "var(--surface2)", borderRadius: 16 }}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="AfriQR code" style={{ width: 220, height: 220, borderRadius: 12 }} />
                  ) : (
                    <div className="spinner" style={{ width: 48, height: 48 }} />
                  )}
                  <p style={{ marginTop: 12, color: "var(--text-dim)", fontSize: "0.875rem" }}>
                    {qrAmount ? `Dynamic QR — fixed at ${Number(qrAmount).toLocaleString()}` : "Static QR — payer chooses the amount"}
                  </p>
                </div>
                {qrPayload && (
                  <button
                    className="btn"
                    style={{ width: "100%", marginTop: 12 }}
                    onClick={() => { navigator.clipboard.writeText(qrPayload); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); }}
                  >
                    {qrCopied ? "Copied!" : "Copy AfriQR payload (EMV TLV)"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === "network" && (
          <>
            {stats && (
              <div className="grid-4" style={{ marginBottom: "1.5rem" }}>
                <div className="stat-card"><div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.participants}</div><div style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>Member institutions</div></div>
                <div className="stat-card"><div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.countries}</div><div style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>Countries</div></div>
                <div className="stat-card"><div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.transfers}</div><div style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>Instant payments</div></div>
                <div className="stat-card"><div style={{ fontSize: "1.5rem", fontWeight: 700 }}>${Number(stats.total_volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div><div style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>Network volume</div></div>
              </div>
            )}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Member institutions</h3>
              <div className="table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                      <th style={{ padding: "0.5rem" }}>Code</th>
                      <th style={{ padding: "0.5rem" }}>Institution</th>
                      <th style={{ padding: "0.5rem" }}>Type</th>
                      <th style={{ padding: "0.5rem" }}>Country</th>
                      <th style={{ padding: "0.5rem" }}>Currency</th>
                      <th style={{ padding: "0.5rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id} style={{ borderTop: "1px solid var(--surface2)" }}>
                        <td style={{ padding: "0.6rem 0.5rem", fontFamily: "monospace", fontSize: "0.85rem" }}>{p.code}</td>
                        <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: "0.6rem 0.5rem", fontSize: "0.875rem" }}>{typeBadge(p.type)}</td>
                        <td style={{ padding: "0.6rem 0.5rem" }}>{p.country}</td>
                        <td style={{ padding: "0.6rem 0.5rem" }}>{p.currency}</td>
                        <td style={{ padding: "0.6rem 0.5rem" }}>
                          <span className={`badge ${p.status === "active" ? "badge-success" : ""}`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
