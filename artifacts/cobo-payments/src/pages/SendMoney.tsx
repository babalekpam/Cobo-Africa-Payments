import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

type Tab = "bank" | "mobile" | "internal";

export default function SendMoney() {
  const { wallets, refreshWallets } = useAuth();
  const [tab, setTab] = useState<Tab>("bank");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);

  const [form, setForm] = useState<any>({
    walletId: "", amount: "", currency: "USD",
    bank_name: "", account_number: "", account_name: "", routing_number: "",
    phone: "", provider: "MTN", recipient_name: "",
    recipient_email: "", note: "",
  });

  useEffect(() => {
    api.get("/beneficiaries").then(({ data }) => setBeneficiaries(data.beneficiaries || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (wallets.length > 0 && !form.walletId) {
      const def = wallets.find(w => w.isDefault) || wallets[0];
      setForm((p: any) => ({ ...p, walletId: String(def.id), currency: def.currency }));
    }
  }, [wallets]);

  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));
  const selectedWallet = wallets.find(w => w.id === Number(form.walletId));
  const fee = tab === "internal" ? 0 : Math.max(0.5, Number(form.amount || 0) * 0.009);

  const send = async () => {
    setError(""); setResult(null); setLoading(true);
    try {
      const body: any = { wallet_id: Number(form.walletId), amount: Number(form.amount), currency: form.currency };
      if (tab === "bank") Object.assign(body, { bank_name: form.bank_name, account_number: form.account_number, account_name: form.account_name, routing_number: form.routing_number });
      if (tab === "mobile") Object.assign(body, { phone: form.phone, provider: form.provider, recipient_name: form.recipient_name });
      if (tab === "internal") Object.assign(body, { recipient_email: form.recipient_email, note: form.note });
      const { data } = await api.post(`/transfers/${tab}`, body);
      setResult(data);
      await refreshWallets();
    } catch (err: any) {
      setError(err.response?.data?.message || "Transfer failed");
    }
    setLoading(false);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "bank", label: "Bank Transfer", icon: "🏦" },
    { key: "mobile", label: "Mobile Money", icon: "📱" },
    { key: "internal", label: "COBO User", icon: "👤" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Send Money</h1>
          <p className="page-subtitle">Transfer funds securely</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`} onClick={() => { setTab(t.key); setResult(null); setError(""); }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {result ? (
          <div className="card-lg fade-in" style={{ maxWidth: 500 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Transfer Initiated</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>Reference: {result.transaction?.reference || result.reference}</p>
              <button className="btn btn-primary" onClick={() => setResult(null)}>Send Another</button>
            </div>
          </div>
        ) : (
          <div className="card-lg" style={{ maxWidth: 500 }}>
            {error && <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid rgba(245,83,83,0.2)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">From Wallet</label>
              <select className="select" value={form.walletId} onChange={e => { set("walletId", e.target.value); const w = wallets.find(w => w.id === Number(e.target.value)); if (w) set("currency", w.currency); }}>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.currency} — Balance: {w.balance.toLocaleString()}</option>)}
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Amount ({form.currency})</label>
              <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
              {Number(form.amount) > 0 && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>Fee: {form.currency} {fee.toFixed(2)} | Total: {form.currency} {(Number(form.amount) + fee).toFixed(2)}</div>}
            </div>

            {tab === "bank" && (
              <>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Bank Name</label><input className="input" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} /></div>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Account Number</label><input className="input" value={form.account_number} onChange={e => set("account_number", e.target.value)} /></div>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Account Name</label><input className="input" value={form.account_name} onChange={e => set("account_name", e.target.value)} /></div>
              </>
            )}

            {tab === "mobile" && (
              <>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Phone Number</label><input className="input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+234..." /></div>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Provider</label><select className="select" value={form.provider} onChange={e => set("provider", e.target.value)}><option>MTN</option><option>Airtel</option><option>Vodafone</option><option>Orange</option><option>Safaricom</option></select></div>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Recipient Name</label><input className="input" value={form.recipient_name} onChange={e => set("recipient_name", e.target.value)} /></div>
              </>
            )}

            {tab === "internal" && (
              <>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Recipient Email</label><input className="input" type="email" value={form.recipient_email} onChange={e => set("recipient_email", e.target.value)} placeholder="user@cobo.africa" /></div>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Note (optional)</label><input className="input" value={form.note} onChange={e => set("note", e.target.value)} /></div>
              </>
            )}

            <button className="btn btn-primary btn-lg btn-full" onClick={send} disabled={loading || !form.amount}>
              {loading ? <span className="spinner" /> : `Send ${form.currency} ${form.amount || "0.00"}`}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
