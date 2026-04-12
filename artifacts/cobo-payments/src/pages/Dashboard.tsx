import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function Dashboard() {
  const { user, wallets } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/dashboard").then(({ data }) => {
      setStats(data.stats);
      setRecent(data.recent_transactions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalUSD = wallets.reduce((s, w) => s + (w.currency === "USD" ? w.balance : 0), 0);

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Welcome back, {user?.first_name} 👋</h1>
          <p className="page-subtitle">Here's your financial overview</p>
        </div>

        <div className="grid-4" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-label">Total Balance</div>
            <div className="stat-card-value" style={{ color: "var(--gold)" }}>
              ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-card-sub">{wallets.length} wallet{wallets.length !== 1 ? "s" : ""} active</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-label">Total Transactions</div>
            <div className="stat-card-value">{stats?.total_transactions ?? "—"}</div>
            <div className="stat-card-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">💵</div>
            <div className="stat-card-label">Total Volume</div>
            <div className="stat-card-value">${(stats?.total_volume ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <div className="stat-card-sub">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🔔</div>
            <div className="stat-card-label">Notifications</div>
            <div className="stat-card-value">{stats?.unread_notifications ?? 0}</div>
            <div className="stat-card-sub">Unread</div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Your Wallets</h3>
            {wallets.length === 0 ? (
              <div className="empty"><div className="empty-icon">💰</div><div className="empty-desc">No wallets yet</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {wallets.map(w => (
                  <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{w.currency}</div>
                      {w.isDefault && <span className="badge badge-warning" style={{ fontSize: 10 }}>Default</span>}
                    </div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>
                      {w.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent Transactions</h3>
            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
            ) : recent.length === 0 ? (
              <div className="empty"><div className="empty-icon">📜</div><div className="empty-desc">No transactions yet</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {recent.slice(0, 8).map((tx: any) => (
                      <tr key={tx.id}>
                        <td style={{ textTransform: "capitalize" }}>{tx.type}</td>
                        <td style={{ fontWeight: 600 }}>{tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td><span className={`badge ${tx.status === "completed" || tx.status === "success" ? "badge-success" : tx.status === "failed" ? "badge-error" : "badge-warning"}`}>{tx.status}</span></td>
                        <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
