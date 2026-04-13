import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const CURRENCY_INFO: Record<string, { flag: string; name: string; symbol: string }> = {
  USD: { flag: "🇺🇸", name: "US Dollar", symbol: "$" },
  EUR: { flag: "🇪🇺", name: "Euro", symbol: "€" },
  GBP: { flag: "🇬🇧", name: "British Pound", symbol: "£" },
  NGN: { flag: "🇳🇬", name: "Nigerian Naira", symbol: "₦" },
  GHS: { flag: "🇬🇭", name: "Ghanaian Cedi", symbol: "GH₵" },
  KES: { flag: "🇰🇪", name: "Kenyan Shilling", symbol: "KSh" },
  ZAR: { flag: "🇿🇦", name: "South African Rand", symbol: "R" },
  XOF: { flag: "🏦", name: "CFA Franc (West)", symbol: "CFA" },
  XAF: { flag: "🏦", name: "CFA Franc (Central)", symbol: "FCFA" },
  TZS: { flag: "🇹🇿", name: "Tanzanian Shilling", symbol: "TSh" },
  UGX: { flag: "🇺🇬", name: "Ugandan Shilling", symbol: "USh" },
  ETB: { flag: "🇪🇹", name: "Ethiopian Birr", symbol: "Br" },
  EGP: { flag: "🇪🇬", name: "Egyptian Pound", symbol: "E£" },
  RWF: { flag: "🇷🇼", name: "Rwandan Franc", symbol: "FRw" },
};

const BANK_DETAILS: Record<string, { bank: string; account: string; name: string; swift: string; branch: string }> = {
  USD: { bank: "COBO Africa International Bank", account: "COBO-USD-001-2024", name: "COBO Africa Payments Ltd", swift: "COBOUSGX", branch: "New York, USA" },
  NGN: { bank: "Guaranty Trust Bank", account: "0123456789", name: "COBO Africa Payments Ltd", swift: "GTBINGLA", branch: "Lagos, Nigeria" },
  GHS: { bank: "GCB Bank", account: "1234567890", name: "COBO Africa Payments GH", swift: "GCBLGHAC", branch: "Accra, Ghana" },
  KES: { bank: "Kenya Commercial Bank", account: "1234567890", name: "COBO Africa Payments KE", swift: "KCBLKENX", branch: "Nairobi, Kenya" },
  ZAR: { bank: "Standard Bank", account: "987654321", name: "COBO Africa Payments ZA", swift: "SBZAZAJJ", branch: "Johannesburg, South Africa" },
  XOF: { bank: "Ecobank UEMOA", account: "SN001-234567", name: "COBO Africa Payments SN", swift: "EABORWRW", branch: "Dakar, Senegal" },
  EUR: { bank: "COBO Africa EU Account", account: "COBO-EUR-001-2024", name: "COBO Africa Payments Ltd", swift: "COBOEU2X", branch: "Brussels, Belgium" },
  GBP: { bank: "COBO Africa UK Account", account: "COBO-GBP-001-2024", name: "COBO Africa Payments Ltd", swift: "COBOGB2L", branch: "London, UK" },
};

type Tab = "deposit" | "history";

interface DepositRequest {
  id: number;
  currency: string;
  amount: number;
  method: string;
  reference: string;
  bankName: string;
  senderName: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export default function Deposit() {
  const { wallets } = useAuth();
  const [tab, setTab] = useState<Tab>("deposit");
  const [selectedCurrency, setSelectedCurrency] = useState(wallets[0]?.currency || "USD");
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState("");
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const info = CURRENCY_INFO[selectedCurrency];
  const bankInfo = BANK_DETAILS[selectedCurrency] || BANK_DETAILS.USD;

  const fetchDeposits = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get("/deposits");
      setDeposits(res.data.deposits || []);
    } catch {}
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (tab === "history") fetchDeposits();
  }, [tab]);

  const submitDeposit = async () => {
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount"); return; }
    if (!senderName.trim()) { setError("Enter the sender name used for the transfer"); return; }
    setLoading(true); setError(""); setSuccess(null);
    try {
      const res = await api.post("/deposits", {
        currency: selectedCurrency,
        amount: Number(amount),
        method: "bank",
        bankName: bankName.trim() || undefined,
        senderName: senderName.trim(),
        senderAccount: senderAccount.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSuccess(res.data.deposit);
      setAmount(""); setSenderName(""); setBankName(""); setSenderAccount(""); setNotes("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit deposit request");
    }
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: "rgba(201,138,26,0.1)", color: "#C98A1A" },
      approved: { bg: "rgba(27,158,90,0.1)", color: "#1B9E5A" },
      rejected: { bg: "rgba(217,54,54,0.1)", color: "#D93636" },
    };
    const c = colors[status] || colors.pending;
    return <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, textTransform: "capitalize" }}>{status}</span>;
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Deposit / Fund Wallet</h1>
          <p className="page-subtitle">Transfer funds to your COBO wallet via bank transfer</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button className={`btn ${tab === "deposit" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setTab("deposit"); setSuccess(null); setError(""); }}>
            🏦 New Deposit
          </button>
          <button className={`btn ${tab === "history" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("history")}>
            📋 My Deposits
          </button>
        </div>

        {tab === "deposit" && (
          <>
            {success ? (
              <div className="card-lg fade-in" style={{ maxWidth: 520, textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(201,138,26,0.1)", color: "#C98A1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, margin: "0 auto 16px" }}>⏳</div>
                <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Deposit Request Submitted</h2>
                <p style={{ color: "var(--text-dim)", marginBottom: 4, fontSize: 15 }}>
                  {CURRENCY_INFO[success.currency]?.symbol}{success.amount.toLocaleString()} {success.currency}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>Reference: <strong style={{ fontFamily: "monospace" }}>{success.reference}</strong></p>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
                  Your deposit will be credited once our team verifies the payment. This usually takes 1–24 hours.
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={() => setSuccess(null)}>Submit Another</button>
                  <button className="btn btn-ghost" onClick={() => setTab("history")}>View History</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="card-lg" style={{ flex: 1, minWidth: 340, maxWidth: 560 }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Step 1: Transfer to Our Bank Account</h3>

                  {error && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid rgba(217,54,54,0.15)", borderRadius: 8, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Deposit Currency</label>
                    <select className="select" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)}>
                      {wallets.map(w => {
                        const ci = CURRENCY_INFO[w.currency];
                        return <option key={w.id} value={w.currency}>{ci?.flag || "💰"} {w.currency} — {ci?.name || w.currency}</option>;
                      })}
                    </select>
                  </div>

                  <div style={{ padding: 16, background: "var(--surface2)", borderRadius: 10, marginBottom: 20 }}>
                    <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13, marginBottom: 12, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Transfer to this account</h4>
                    {[
                      { label: "Bank", value: bankInfo.bank },
                      { label: "Account Name", value: bankInfo.name },
                      { label: "Account Number", value: bankInfo.account },
                      { label: "SWIFT/BIC", value: bankInfo.swift },
                      { label: "Branch", value: bankInfo.branch },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                        <span style={{ color: "var(--text-dim)" }}>{row.label}</span>
                        <span style={{ fontWeight: 600, fontFamily: row.label === "Account Number" || row.label === "SWIFT/BIC" ? "monospace" : "inherit" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Step 2: Tell Us About Your Transfer</h3>

                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Amount Transferred ({info?.flag} {selectedCurrency})</label>
                    <input className="input" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ fontSize: 18, fontWeight: 600 }} />
                  </div>

                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Sender Name (as it appears on the transfer) *</label>
                    <input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Abel Nkawula" />
                  </div>

                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Your Bank Name</label>
                      <input className="input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. GTBank" />
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Your Account Number</label>
                      <input className="input" value={senderAccount} onChange={e => setSenderAccount(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>

                  <div className="input-group" style={{ marginBottom: 20 }}>
                    <label className="input-label">Notes (optional)</label>
                    <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional details about the transfer..." rows={3} style={{ resize: "vertical" }} />
                  </div>

                  <button className="btn btn-primary btn-lg btn-full" onClick={submitDeposit} disabled={loading || !amount || Number(amount) <= 0 || !senderName.trim()}>
                    {loading ? <span className="spinner" /> : `Submit Deposit Request — ${info?.symbol || ""}${amount || "0.00"} ${selectedCurrency}`}
                  </button>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>Your wallet will be credited after our team verifies the payment (1–24 hours).</p>
                </div>

                <div style={{ minWidth: 260, maxWidth: 300, flex: "0 0 auto" }}>
                  <div className="card" style={{ position: "sticky", top: 20 }}>
                    <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>How It Works</h4>
                    <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
                      {[
                        { step: "1", text: "Transfer funds from your bank to our account shown on the left." },
                        { step: "2", text: "Fill in the details of your transfer and submit." },
                        { step: "3", text: "Our team verifies the payment (1–24 hours)." },
                        { step: "4", text: "Your COBO wallet is credited automatically." },
                      ].map(s => (
                        <div key={s.step} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(201,138,26,0.1)", color: "#C98A1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                          <span>{s.text}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: 12, background: "var(--surface2)", borderRadius: 8, marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Current Balance</div>
                      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20 }}>
                        {info?.symbol}{(wallets.find(w => w.currency === selectedCurrency)?.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{info?.flag} {selectedCurrency} — {info?.name}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "history" && (
          <div className="card-lg">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Deposit History</h3>
            {loadingHistory ? (
              <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
            ) : deposits.length === 0 ? (
              <div className="empty">
                <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                <p>No deposits yet. Submit your first deposit request above.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Currency</th>
                      <th>Amount</th>
                      <th>Sender</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map(d => {
                      const ci = CURRENCY_INFO[d.currency];
                      return (
                        <tr key={d.id}>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.reference}</td>
                          <td>{ci?.flag} {d.currency}</td>
                          <td style={{ fontWeight: 600 }}>{ci?.symbol}{d.amount.toLocaleString()}</td>
                          <td>{d.senderName}</td>
                          <td>
                            {statusBadge(d.status)}
                            {d.status === "rejected" && d.rejectionReason && (
                              <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{d.rejectionReason}</div>
                            )}
                          </td>
                          <td style={{ fontSize: 13 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
