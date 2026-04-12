import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

type Method = "bank" | "card" | "mobile";

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

export default function Deposit() {
  const { wallets, refreshWallets } = useAuth();
  const [method, setMethod] = useState<Method>("bank");
  const [selectedWallet, setSelectedWallet] = useState(wallets[0]?.currency || "USD");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvv: "", name: "" });

  const info = CURRENCY_INFO[selectedWallet];
  const bankInfo = BANK_DETAILS[selectedWallet] || BANK_DETAILS.USD;

  const fundWallet = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true); setError(""); setResult(null);
    try {
      await api.post("/wallets/fund", { currency: selectedWallet, amount: Number(amount) });
      await refreshWallets();
      setResult({ amount: Number(amount), currency: selectedWallet, method });
      setAmount("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Deposit failed");
    }
    setLoading(false);
  };

  const methods: { key: Method; label: string; icon: string }[] = [
    { key: "bank", label: "Bank Deposit", icon: "🏦" },
    { key: "card", label: "Card Top-Up", icon: "💳" },
    { key: "mobile", label: "Mobile Money", icon: "📱" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Deposit / Receive Money</h1>
          <p className="page-subtitle">Add funds to your COBO wallet</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {methods.map(m => (
            <button key={m.key} className={`btn ${method === m.key ? "btn-primary" : "btn-ghost"}`} onClick={() => { setMethod(m.key); setResult(null); setError(""); }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {result ? (
          <div className="card-lg fade-in" style={{ maxWidth: 500, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#edf7f2", color: "#1B9E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, margin: "0 auto 16px" }}>✓</div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Deposit Successful</h2>
            <p style={{ color: "var(--text-dim)", marginBottom: 4, fontSize: 15 }}>
              {info?.symbol}{result.amount.toLocaleString()} {result.currency} added to your wallet
            </p>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 20 }}>via {result.method === "bank" ? "Bank Transfer" : result.method === "card" ? "Card Payment" : "Mobile Money"}</p>
            <button className="btn btn-primary" onClick={() => setResult(null)}>Make Another Deposit</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div className="card-lg" style={{ flex: 1, minWidth: 340, maxWidth: 520 }}>
              {error && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid rgba(217,54,54,0.15)", borderRadius: 8, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Deposit To</label>
                <select className="select" value={selectedWallet} onChange={e => setSelectedWallet(e.target.value)}>
                  {wallets.map(w => {
                    const ci = CURRENCY_INFO[w.currency];
                    return <option key={w.id} value={w.currency}>{ci?.flag || "💰"} {w.currency} — {ci?.name || w.currency} (Balance: {ci?.symbol}{w.balance.toLocaleString()})</option>;
                  })}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Amount ({info?.flag} {selectedWallet})</label>
                <input className="input" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ fontSize: 18, fontWeight: 600 }} />
              </div>

              {method === "bank" && (
                <div style={{ padding: 16, background: "var(--surface2)", borderRadius: 10, marginBottom: 20 }}>
                  <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--gold)" }}>BANK TRANSFER DETAILS</h4>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>Transfer funds to the account below. Your wallet will be credited once payment is confirmed.</p>
                  {[
                    { label: "Bank", value: bankInfo.bank },
                    { label: "Account Name", value: bankInfo.name },
                    { label: "Account Number", value: bankInfo.account },
                    { label: "SWIFT/BIC", value: bankInfo.swift },
                    { label: "Branch", value: bankInfo.branch },
                    { label: "Reference", value: `COBO-DEP-${Date.now().toString(36).toUpperCase()}` },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>{row.label}</span>
                      <span style={{ fontWeight: 600, fontFamily: row.label === "Account Number" || row.label === "SWIFT/BIC" || row.label === "Reference" ? "monospace" : "inherit" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {method === "card" && (
                <>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Cardholder Name</label>
                    <input className="input" value={cardForm.name} onChange={e => setCardForm(p => ({ ...p, name: e.target.value }))} placeholder="Name on card" />
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Card Number</label>
                    <input className="input" value={cardForm.number} onChange={e => setCardForm(p => ({ ...p, number: e.target.value }))} placeholder="4242 4242 4242 4242" maxLength={19} style={{ fontFamily: "monospace" }} />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">Expiry</label>
                      <input className="input" value={cardForm.expiry} onChange={e => setCardForm(p => ({ ...p, expiry: e.target.value }))} placeholder="MM/YY" maxLength={5} />
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label className="input-label">CVV</label>
                      <input className="input" value={cardForm.cvv} onChange={e => setCardForm(p => ({ ...p, cvv: e.target.value }))} placeholder="123" maxLength={4} type="password" />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 18 }}>🔒</span>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Secured with 256-bit SSL encryption. Sandbox mode — no real charges.</span>
                  </div>
                </>
              )}

              {method === "mobile" && (
                <div style={{ padding: 16, background: "var(--surface2)", borderRadius: 10, marginBottom: 20 }}>
                  <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--gold)" }}>MOBILE MONEY DEPOSIT</h4>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>Send money to the COBO collection number below:</p>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                    <span style={{ color: "var(--text-dim)" }}>Provider</span>
                    <span style={{ fontWeight: 600 }}>All Providers Accepted</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, borderTop: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-dim)" }}>Number</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>*880*COBO#</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, borderTop: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-dim)" }}>Reference</span>
                    <span style={{ fontWeight: 600, fontFamily: "monospace" }}>COBO-{Date.now().toString(36).toUpperCase().slice(-6)}</span>
                  </div>
                </div>
              )}

              <button className="btn btn-primary btn-lg btn-full" onClick={fundWallet} disabled={loading || !amount || Number(amount) <= 0}>
                {loading ? <span className="spinner" /> : `Deposit ${info?.symbol || ""}${amount || "0.00"} ${selectedWallet}`}
              </button>
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>Sandbox mode — deposits are instant for testing</p>
            </div>

            <div style={{ minWidth: 260, maxWidth: 300, flex: "0 0 auto" }}>
              <div className="card" style={{ position: "sticky", top: 20 }}>
                <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Deposit Info</h4>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
                  {method === "bank" ? "Bank transfers typically take 1-3 business days to reflect." :
                   method === "card" ? "Card top-ups are instant. A 2.5% processing fee applies." :
                   "Mobile money deposits are processed within 5 minutes."}
                </div>
                <div style={{ padding: 12, background: "var(--surface2)", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Current Balance</div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20 }}>
                    {info?.symbol}{(wallets.find(w => w.currency === selectedWallet)?.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{info?.flag} {selectedWallet} — {info?.name}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
