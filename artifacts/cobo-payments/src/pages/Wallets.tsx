import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const CURRENCIES = ["USD", "NGN", "GHS", "KES", "XOF", "XAF", "ZAR", "EGP", "TZS", "UGX", "ETB", "RWF", "GBP", "EUR", "MAD"];

export default function Wallets() {
  const { wallets, refreshWallets } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [loading, setLoading] = useState(false);

  const addWallet = async () => {
    setLoading(true);
    try {
      await api.post("/wallets", { currency });
      await refreshWallets();
      setShowAdd(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add wallet");
    }
    setLoading(false);
  };

  const setDefault = async (id: number) => {
    await api.put(`/wallets/${id}/default`);
    await refreshWallets();
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 className="page-title">Wallets</h1>
            <p className="page-subtitle">Manage your multi-currency wallets</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Wallet</button>
        </div>

        {wallets.length === 0 ? (
          <div className="card"><div className="empty"><div className="empty-icon">💰</div><div className="empty-title">No wallets</div><div className="empty-desc">Add your first wallet to start transacting</div></div></div>
        ) : (
          <div className="grid-3">
            {wallets.map(w => (
              <div key={w.id} className="card" style={{ position: "relative" }}>
                {w.isDefault && <span className="badge badge-warning" style={{ position: "absolute", top: 16, right: 16 }}>Default</span>}
                <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                <div style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 500 }}>{w.currency} Wallet</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, marginTop: 4 }}>
                  {w.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
                {w.lockedBalance > 0 && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>🔒 Locked: {w.lockedBalance.toLocaleString()}</div>}
                {!w.isDefault && <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setDefault(w.id)}>Set as Default</button>}
              </div>
            ))}
          </div>
        )}

        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <div className="card-lg fade-in" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Add New Wallet</h3>
              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Currency</label>
                <select className="select" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.filter(c => !wallets.find(w => w.currency === c)).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={addWallet} disabled={loading}>{loading ? <span className="spinner" /> : "Create Wallet"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
