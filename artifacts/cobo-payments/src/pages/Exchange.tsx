import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function Exchange() {
  const { wallets, refreshWallets } = useAuth();
  const [rates, setRates] = useState<any>({});
  const [fromCur, setFromCur] = useState("USD");
  const [toCur, setToCur] = useState("NGN");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/exchange/rates").then(({ data }) => setRates(data.rates || {})).catch(() => {});
  }, []);

  const getQuote = async () => {
    if (!amount) return;
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/exchange/convert", { from: fromCur, to: toCur, amount: Number(amount) });
      setQuote(data);
    } catch (err: any) { setError(err.response?.data?.message || "Quote failed"); }
    setLoading(false);
  };

  const executeSwap = async () => {
    setLoading(true); setError("");
    try {
      const fromWallet = wallets.find(w => w.currency === fromCur);
      const toWallet = wallets.find(w => w.currency === toCur);
      if (!fromWallet || !toWallet) { setError("Missing wallet for swap"); setLoading(false); return; }
      const { data } = await api.post("/exchange/swap", { from_wallet_id: fromWallet.id, to_wallet_id: toWallet.id, amount: Number(amount) });
      setResult(data);
      await refreshWallets();
    } catch (err: any) { setError(err.response?.data?.message || "Swap failed"); }
    setLoading(false);
  };

  const currencies = [...new Set(wallets.map(w => w.currency))];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">FX Exchange</h1>
          <p className="page-subtitle">Convert between your wallet currencies</p>
        </div>

        {result ? (
          <div className="card-lg fade-in" style={{ maxWidth: 500 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💱</div>
              <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Swap Complete!</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>Your balances have been updated</p>
              <button className="btn btn-primary" onClick={() => { setResult(null); setQuote(null); setAmount(""); }}>New Exchange</button>
            </div>
          </div>
        ) : (
          <div className="grid-2">
            <div className="card-lg">
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Convert Currency</h3>
              {error && <div style={{ padding: "10px 14px", background: "var(--red-bg)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">From</label>
                <select className="select" value={fromCur} onChange={e => { setFromCur(e.target.value); setQuote(null); }}>
                  {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ textAlign: "center", margin: "8px 0", fontSize: 20 }}>⇅</div>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">To</label>
                <select className="select" value={toCur} onChange={e => { setToCur(e.target.value); setQuote(null); }}>
                  {currencies.filter(c => c !== fromCur).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Amount ({fromCur})</label>
                <input className="input" type="number" min="0" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setQuote(null); }} placeholder="0.00" />
              </div>

              {!quote ? (
                <button className="btn btn-primary btn-lg btn-full" onClick={getQuote} disabled={loading || !amount}>{loading ? <span className="spinner" /> : "Get Quote"}</button>
              ) : (
                <div>
                  <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", marginBottom: 16, border: "1px solid var(--border-gold)" }}>
                    <div style={{ fontSize: 13, color: "var(--text-dim)" }}>You'll receive approximately</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, color: "var(--gold)", marginTop: 4 }}>
                      {toCur} {Number(quote.converted).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>Rate: 1 {fromCur} = {quote.rate} {toCur}</div>
                  </div>
                  <button className="btn btn-primary btn-lg btn-full" onClick={executeSwap} disabled={loading}>{loading ? <span className="spinner" /> : "Confirm Swap"}</button>
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Exchange Rates (vs USD)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(rates).map(([cur, rate]) => (
                  <div key={cur} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                    <span style={{ fontWeight: 600 }}>{cur}</span>
                    <span style={{ color: "var(--text-dim)" }}>{String(rate)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
