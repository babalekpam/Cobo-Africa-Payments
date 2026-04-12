import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

export default function Developer() {
  const { user } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const fakeKey = `cobo_live_${btoa(String(user?.id || 0)).slice(0, 20)}...`;

  const endpoints = [
    { method: "POST", path: "/api/auth/login", desc: "Authenticate user" },
    { method: "GET", path: "/api/auth/me", desc: "Get current user" },
    { method: "GET", path: "/api/wallets", desc: "List wallets" },
    { method: "POST", path: "/api/wallets", desc: "Create wallet" },
    { method: "POST", path: "/api/transfers/bank", desc: "Bank transfer" },
    { method: "POST", path: "/api/transfers/mobile", desc: "Mobile money transfer" },
    { method: "POST", path: "/api/transfers/internal", desc: "Internal transfer" },
    { method: "GET", path: "/api/exchange/rates", desc: "Get FX rates" },
    { method: "POST", path: "/api/exchange/swap", desc: "Currency swap" },
    { method: "GET", path: "/api/beneficiaries", desc: "List beneficiaries" },
    { method: "GET", path: "/api/payment-links", desc: "List payment links" },
    { method: "POST", path: "/api/payment-links", desc: "Create payment link" },
    { method: "GET", path: "/api/notifications", desc: "List notifications" },
    { method: "GET", path: "/api/transactions", desc: "List transactions" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Developer API</h1>
          <p className="page-subtitle">Integrate COBO into your applications</p>
        </div>

        <div className="grid-2" style={{ marginBottom: 28 }}>
          <div className="card-lg">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>API Key</h3>
            <div style={{ padding: "14px 16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontFamily: "monospace", fontSize: 13, color: "var(--gold)", wordBreak: "break-all", marginBottom: 12 }}>
              {showKey ? fakeKey : "••••••••••••••••••••••••"}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(!showKey)}>{showKey ? "Hide" : "Reveal"} Key</button>
          </div>
          <div className="card-lg">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Authentication</h3>
            <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6 }}>
              <p>All API requests require a Bearer token:</p>
              <div style={{ padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontFamily: "monospace", fontSize: 12, marginTop: 8 }}>
                Authorization: Bearer {"<your_token>"}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>API Endpoints</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
              <tbody>
                {endpoints.map((ep, i) => (
                  <tr key={i}>
                    <td><span className={`badge ${ep.method === "GET" ? "badge-info" : ep.method === "POST" ? "badge-success" : "badge-warning"}`} style={{ fontFamily: "monospace", fontSize: 11 }}>{ep.method}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 13 }}>{ep.path}</td>
                    <td style={{ color: "var(--text-dim)" }}>{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
