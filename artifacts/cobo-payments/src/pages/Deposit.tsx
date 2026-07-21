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
  USD: { bank: "IAPAY International Bank", account: "IAPAY-USD-001-2024", name: "IAPAY (Inter-Africa Pay) Ltd", swift: "IAPAYUSGX", branch: "New York, USA" },
  NGN: { bank: "Guaranty Trust Bank", account: "0123456789", name: "IAPAY (Inter-Africa Pay) Ltd", swift: "GTBINGLA", branch: "Lagos, Nigeria" },
  GHS: { bank: "GCB Bank", account: "1234567890", name: "IAPAY (Inter-Africa Pay) GH", swift: "GCBLGHAC", branch: "Accra, Ghana" },
  KES: { bank: "Kenya Commercial Bank", account: "1234567890", name: "IAPAY (Inter-Africa Pay) KE", swift: "KCBLKENX", branch: "Nairobi, Kenya" },
  ZAR: { bank: "Standard Bank", account: "987654321", name: "IAPAY (Inter-Africa Pay) ZA", swift: "SBZAZAJJ", branch: "Johannesburg, South Africa" },
  XOF: { bank: "Ecobank UEMOA", account: "SN001-234567", name: "IAPAY (Inter-Africa Pay) SN", swift: "EABORWRW", branch: "Dakar, Senegal" },
  EUR: { bank: "IAPAY EU Account", account: "IAPAY-EUR-001-2024", name: "IAPAY (Inter-Africa Pay) Ltd", swift: "IAPAYEU2X", branch: "Brussels, Belgium" },
  GBP: { bank: "IAPAY UK Account", account: "IAPAY-GBP-001-2024", name: "IAPAY (Inter-Africa Pay) Ltd", swift: "IAPAYGB2L", branch: "London, UK" },
};

const MOBILE_MONEY_PROVIDERS: Record<string, { name: string; code: string; icon: string }[]> = {
  KES: [
    { name: "M-Pesa", code: "mpesa", icon: "📱" },
    { name: "Airtel Money", code: "airtel", icon: "📱" },
  ],
  GHS: [
    { name: "MTN MoMo", code: "mtn_momo", icon: "📱" },
    { name: "Vodafone Cash", code: "vodafone_cash", icon: "📱" },
    { name: "AirtelTigo Money", code: "airteltigo", icon: "📱" },
  ],
  UGX: [
    { name: "MTN Mobile Money", code: "mtn_ug", icon: "📱" },
    { name: "Airtel Money", code: "airtel_ug", icon: "📱" },
  ],
  TZS: [
    { name: "M-Pesa Tanzania", code: "mpesa_tz", icon: "📱" },
    { name: "Tigo Pesa", code: "tigo_pesa", icon: "📱" },
  ],
  RWF: [
    { name: "MTN MoMo Rwanda", code: "mtn_rw", icon: "📱" },
    { name: "Airtel Money Rwanda", code: "airtel_rw", icon: "📱" },
  ],
  NGN: [
    { name: "OPay", code: "opay", icon: "📱" },
    { name: "PalmPay", code: "palmpay", icon: "📱" },
  ],
  XOF: [
    { name: "Orange Money", code: "orange_money", icon: "📱" },
    { name: "Wave", code: "wave", icon: "📱" },
  ],
};

type Tab = "deposit" | "history";
type Method = "bank" | "card" | "mobile";

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
  const [method, setMethod] = useState<Method>("bank");
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
  const [mobileProvider, setMobileProvider] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");

  const info = CURRENCY_INFO[selectedCurrency];
  const bankInfo = BANK_DETAILS[selectedCurrency] || BANK_DETAILS.USD;
  const mobileProviders = MOBILE_MONEY_PROVIDERS[selectedCurrency] || [];

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

  useEffect(() => {
    if (mobileProviders.length > 0 && !mobileProvider) {
      setMobileProvider(mobileProviders[0].code);
    }
  }, [selectedCurrency]);

  const submitDeposit = async () => {
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount"); return; }

    if (method === "bank" && !senderName.trim()) { setError("Enter the sender name used for the transfer"); return; }
    if (method === "mobile" && !mobileNumber.trim()) { setError("Enter your mobile money number"); return; }
    if (method === "card") {
      if (!cardNumber.replace(/\s/g, "").match(/^\d{13,19}$/)) { setError("Enter a valid card number"); return; }
      if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) { setError("Enter card expiry as MM/YY"); return; }
      if (!cardCvc.match(/^\d{3,4}$/)) { setError("Enter a valid CVC"); return; }
      if (!cardName.trim()) { setError("Enter the cardholder name"); return; }
    }

    setLoading(true); setError(""); setSuccess(null);
    try {
      const body: any = {
        currency: selectedCurrency,
        amount: Number(amount),
        method,
      };

      if (method === "bank") {
        body.bankName = bankName.trim() || undefined;
        body.senderName = senderName.trim();
        body.senderAccount = senderAccount.trim() || undefined;
        body.notes = notes.trim() || undefined;
      } else if (method === "mobile") {
        body.senderName = mobileNumber.trim();
        body.bankName = mobileProvider;
        body.notes = `Mobile Money: ${mobileProviders.find(p => p.code === mobileProvider)?.name || mobileProvider} - ${mobileNumber}`;
      } else if (method === "card") {
        body.senderName = cardName.trim();
        body.bankName = "Card Payment";
        body.senderAccount = cardNumber.replace(/\s/g, "").slice(-4);
        body.notes = `Card ending in ${cardNumber.replace(/\s/g, "").slice(-4)}`;
      }

      const res = await api.post("/deposits", body);
      setSuccess(res.data.deposit);
      setAmount(""); setSenderName(""); setBankName(""); setSenderAccount(""); setNotes("");
      setMobileNumber(""); setCardNumber(""); setCardExpiry(""); setCardCvc(""); setCardName("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit deposit request");
    }
    setLoading(false);
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
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

  const methods: { key: Method; label: string; icon: string; desc: string }[] = [
    { key: "bank", label: "Bank Transfer", icon: "🏦", desc: "Wire or local bank transfer" },
    { key: "card", label: "Card Payment", icon: "💳", desc: "Visa, Mastercard, Verve" },
    ...(mobileProviders.length > 0 ? [{ key: "mobile" as Method, label: "Mobile Money", icon: "📱", desc: "M-Pesa, MTN MoMo, etc." }] : []),
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Deposit / Fund Wallet</h1>
          <p className="page-subtitle">Add funds to your IAPAY wallet</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button className={`btn ${tab === "deposit" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setTab("deposit"); setSuccess(null); setError(""); }}>
            💰 New Deposit
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
                  {method === "card" ? "Your card payment is being processed. This may take a few minutes." : "Your deposit will be credited once our team verifies the payment. This usually takes 1-24 hours."}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={() => setSuccess(null)}>Submit Another</button>
                  <button className="btn btn-ghost" onClick={() => setTab("history")}>View History</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="card-lg" style={{ flex: 1, minWidth: 340, maxWidth: 600 }}>
                  <div className="input-group" style={{ marginBottom: 20 }}>
                    <label className="input-label">Deposit Currency</label>
                    <select className="select" value={selectedCurrency} onChange={e => { setSelectedCurrency(e.target.value); setMobileProvider(""); }}>
                      {wallets.map(w => {
                        const ci = CURRENCY_INFO[w.currency];
                        return <option key={w.id} value={w.currency}>{ci?.flag || "💰"} {w.currency} — {ci?.name || w.currency}</option>;
                      })}
                    </select>
                  </div>

                  <label className="input-label" style={{ marginBottom: 10 }}>Payment Method</label>
                  <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                    {methods.map(m => (
                      <div key={m.key} onClick={() => setMethod(m.key)}
                        style={{
                          flex: 1, minWidth: 120, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                          border: method === m.key ? "2px solid var(--gold)" : "2px solid var(--border)",
                          background: method === m.key ? "rgba(201,138,26,0.04)" : "var(--surface2)",
                          transition: "all 0.15s",
                        }}>
                        <div style={{ fontSize: 24, marginBottom: 6 }}>{m.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>

                  {error && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid rgba(217,54,54,0.15)", borderRadius: 8, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Amount ({info?.flag} {selectedCurrency})</label>
                    <input className="input" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ fontSize: 18, fontWeight: 600 }} />
                  </div>

                  {method === "bank" && (
                    <>
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

                      <div className="input-group" style={{ marginBottom: 16 }}>
                        <label className="input-label">Sender Name *</label>
                        <input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Name as it appears on the transfer" />
                      </div>

                      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label className="input-label">Your Bank</label>
                          <input className="input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. GTBank" />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label className="input-label">Your Account</label>
                          <input className="input" value={senderAccount} onChange={e => setSenderAccount(e.target.value)} placeholder="Optional" />
                        </div>
                      </div>

                      <div className="input-group" style={{ marginBottom: 20 }}>
                        <label className="input-label">Notes (optional)</label>
                        <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details..." rows={2} style={{ resize: "vertical" }} />
                      </div>
                    </>
                  )}

                  {method === "card" && (
                    <>
                      <div style={{ padding: 16, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10, marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>🔒</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "#3B82F6" }}>Secure Card Payment</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                          Card payments are processed securely. A 2.9% + $0.30 processing fee applies. Your card details are encrypted and never stored.
                        </p>
                      </div>

                      <div className="input-group" style={{ marginBottom: 16 }}>
                        <label className="input-label">Cardholder Name</label>
                        <input className="input" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card" />
                      </div>

                      <div className="input-group" style={{ marginBottom: 16 }}>
                        <label className="input-label">Card Number</label>
                        <input className="input" value={cardNumber} onChange={e => setCardNumber(formatCardNumber(e.target.value))} placeholder="4242 4242 4242 4242" maxLength={19} style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} />
                      </div>

                      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label className="input-label">Expiry</label>
                          <input className="input" value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                          <label className="input-label">CVC</label>
                          <input className="input" type="password" value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" maxLength={4} />
                        </div>
                      </div>
                    </>
                  )}

                  {method === "mobile" && (
                    <>
                      <div className="input-group" style={{ marginBottom: 16 }}>
                        <label className="input-label">Mobile Money Provider</label>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {mobileProviders.map(p => (
                            <div key={p.code} onClick={() => setMobileProvider(p.code)}
                              style={{
                                padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                                border: mobileProvider === p.code ? "2px solid var(--gold)" : "2px solid var(--border)",
                                background: mobileProvider === p.code ? "rgba(201,138,26,0.04)" : "transparent",
                              }}>
                              {p.icon} {p.name}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="input-group" style={{ marginBottom: 16 }}>
                        <label className="input-label">Mobile Number *</label>
                        <input className="input" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="+254 7XX XXX XXX" style={{ fontFamily: "monospace" }} />
                      </div>

                      <div style={{ padding: 16, background: "rgba(201,138,26,0.04)", border: "1px solid rgba(201,138,26,0.15)", borderRadius: 10, marginBottom: 20 }}>
                        <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--gold)" }}>How Mobile Money Works</h4>
                        <ol style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                          <li>Submit this deposit request</li>
                          <li>You'll receive a push notification on your phone</li>
                          <li>Approve the payment on your mobile money app</li>
                          <li>Funds are credited to your IAPAY wallet instantly</li>
                        </ol>
                      </div>
                    </>
                  )}

                  <button className="btn btn-primary btn-lg btn-full" onClick={submitDeposit} disabled={loading || !amount || Number(amount) <= 0}>
                    {loading ? <span className="spinner" /> : `Submit ${method === "card" ? "Card Payment" : method === "mobile" ? "Mobile Money" : "Deposit"} — ${info?.symbol || ""}${amount || "0.00"} ${selectedCurrency}`}
                  </button>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>
                    {method === "card" ? "Processing fee: 2.9% + $0.30. Credited within minutes." : method === "mobile" ? "No additional fees for mobile money deposits." : "Your wallet will be credited after verification (1-24 hours)."}
                  </p>
                </div>

                <div style={{ minWidth: 260, maxWidth: 300, flex: "0 0 auto" }}>
                  <div className="card" style={{ position: "sticky", top: 20 }}>
                    <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Deposit Methods</h4>
                    <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
                      {[
                        { icon: "🏦", title: "Bank Transfer", desc: "Free. Credited in 1-24 hours after verification." },
                        { icon: "💳", title: "Card Payment", desc: "2.9% + $0.30 fee. Credited within minutes." },
                        { icon: "📱", title: "Mobile Money", desc: "No fee. Instant for supported currencies." },
                      ].map(m => (
                        <div key={m.title} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                          <div style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{m.desc}</div>
                          </div>
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
                      <th>Method</th>
                      <th>Currency</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map(d => {
                      const ci = CURRENCY_INFO[d.currency];
                      const methodIcon = d.method === "card" ? "💳" : d.method === "mobile" ? "📱" : "🏦";
                      return (
                        <tr key={d.id}>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.reference}</td>
                          <td>{methodIcon} {d.method}</td>
                          <td>{ci?.flag} {d.currency}</td>
                          <td style={{ fontWeight: 600 }}>{ci?.symbol}{d.amount.toLocaleString()}</td>
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
