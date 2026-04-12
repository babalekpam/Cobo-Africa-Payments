import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "wouter";
import api from "../lib/api";

const CURRENCY_INFO: Record<string, { flag: string; symbol: string; color: string }> = {
  USD: { flag: "🇺🇸", symbol: "$", color: "#4A90D9" },
  EUR: { flag: "🇪🇺", symbol: "€", color: "#0052B4" },
  GBP: { flag: "🇬🇧", symbol: "£", color: "#CF142B" },
  NGN: { flag: "🇳🇬", symbol: "₦", color: "#008751" },
  GHS: { flag: "🇬🇭", symbol: "GH₵", color: "#CE1126" },
  KES: { flag: "🇰🇪", symbol: "KSh", color: "#BB0000" },
  ZAR: { flag: "🇿🇦", symbol: "R", color: "#007749" },
  XOF: { flag: "🏦", symbol: "CFA", color: "#D4A017" },
  XAF: { flag: "🏦", symbol: "FCFA", color: "#BF8D2C" },
  TZS: { flag: "🇹🇿", symbol: "TSh", color: "#1EB53A" },
  UGX: { flag: "🇺🇬", symbol: "USh", color: "#FCDC04" },
  ETB: { flag: "🇪🇹", symbol: "Br", color: "#078930" },
  EGP: { flag: "🇪🇬", symbol: "E£", color: "#C09300" },
  RWF: { flag: "🇷🇼", symbol: "FRw", color: "#00A1DE" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Dashboard() {
  const { user, wallets } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    api.get("/auth/dashboard").then(({ data }) => {
      setStats(data.stats);
      setRecent(data.recent_transactions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalUSD = wallets.reduce((s, w) => s + (w.currency === "USD" ? w.balance : 0), 0);
  const totalAllWallets = wallets.reduce((s, w) => s + w.balance, 0);
  const maxBalance = Math.max(...wallets.map(w => w.balance), 1);

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const txsInMonth = recent.filter(tx => {
      const txDate = new Date(tx.createdAt);
      return txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear();
    });
    return {
      month: MONTHS[d.getMonth()],
      count: txsInMonth.length,
      volume: txsInMonth.reduce((s: number, tx: any) => s + Number(tx.amount || 0), 0),
    };
  });
  const maxVolume = Math.max(...monthlyData.map(m => m.volume), 1);

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Welcome back, {user?.first_name} 👋</h1>
          <p className="page-subtitle">Here's your financial overview</p>
        </div>

        {user && user.kyc_status !== "verified" && (
          <div style={{
            padding: "14px 20px", marginBottom: 20, borderRadius: "var(--radius)",
            display: "flex", alignItems: "center", gap: 14,
            background: user.kyc_status === "submitted" ? "rgba(201,138,26,0.08)" : "var(--red-bg)",
            border: `1px solid ${user.kyc_status === "submitted" ? "var(--border-gold)" : "rgba(217,54,54,0.2)"}`,
          }}>
            <span style={{ fontSize: 22 }}>{user.kyc_status === "submitted" ? "🔄" : "🛡️"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 2 }}>
                {user.kyc_status === "submitted" ? "Identity verification in progress" : "Identity verification required"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                {user.kyc_status === "submitted"
                  ? "Your documents are being reviewed. This usually takes 1-2 business days."
                  : "Verify your identity to unlock full platform features and higher transaction limits."}
              </div>
            </div>
            {user.kyc_status !== "submitted" && (
              <a href="/verification" style={{ color: "var(--gold)", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>Verify Now</a>
            )}
          </div>
        )}

        <div className="grid-4" style={{ marginBottom: 28 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setLocation("/wallets")}>
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-label">Total Balance</div>
            <div className="stat-card-value" style={{ color: "var(--gold)" }}>
              ${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-card-sub">{wallets.length} wallet{wallets.length !== 1 ? "s" : ""} active</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setLocation("/transactions")}>
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-label">Total Transactions</div>
            <div className="stat-card-value">{stats?.total_transactions ?? "—"}</div>
            <div className="stat-card-sub">All time</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setLocation("/send")}>
            <div className="stat-card-icon">💵</div>
            <div className="stat-card-label">Total Volume</div>
            <div className="stat-card-value">${(stats?.total_volume ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <div className="stat-card-sub">Completed</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setLocation("/notifications")}>
            <div className="stat-card-icon">🔔</div>
            <div className="stat-card-label">Notifications</div>
            <div className="stat-card-value">{stats?.unread_notifications ?? 0}</div>
            <div className="stat-card-sub">Unread</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => setLocation("/send")} style={{ gap: 8 }}>💸 Send Money</button>
          <button className="btn btn-ghost" onClick={() => setLocation("/deposit")} style={{ gap: 8 }}>💰 Deposit</button>
          <button className="btn btn-ghost" onClick={() => setLocation("/exchange")} style={{ gap: 8 }}>💱 Exchange</button>
          <button className="btn btn-ghost" onClick={() => setLocation("/payment-links")} style={{ gap: 8 }}>🔗 Payment Link</button>
        </div>

        <div className="grid-2" style={{ marginBottom: 28 }}>
          <div className="card">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Wallet Breakdown</h3>
            {wallets.length === 0 ? (
              <div className="empty"><div className="empty-icon">💰</div><div className="empty-desc">No wallets yet</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {wallets.map(w => {
                  const ci = CURRENCY_INFO[w.currency] || { flag: "💰", symbol: w.currency, color: "#C98A1A" };
                  const pct = maxBalance > 0 ? (w.balance / maxBalance) * 100 : 0;
                  return (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18, width: 26, textAlign: "center" }}>{ci.flag}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{w.currency}</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{ci.symbol}{w.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(pct, 2)}%`, background: ci.color, borderRadius: 3, transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Transaction Activity</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 4px" }}>
              {monthlyData.map((m, i) => {
                const h = maxVolume > 0 ? (m.volume / maxVolume) * 100 : 0;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>{m.count}</div>
                    <div style={{ width: "100%", maxWidth: 32, height: `${Math.max(h, 4)}%`, background: "var(--gold)", borderRadius: "4px 4px 0 0", minHeight: 4, transition: "height 0.5s ease" }} />
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{m.month}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>Transactions per month (last 6 months)</div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16 }}>Recent Transactions</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setLocation("/transactions")}>View All →</button>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
          ) : recent.length === 0 ? (
            <div className="empty"><div className="empty-icon">📜</div><div className="empty-desc">No transactions yet</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Description</th><th>Date</th></tr></thead>
                <tbody>
                  {recent.slice(0, 8).map((tx: any) => (
                    <tr key={tx.id} onClick={() => setLocation(`/transactions/${tx.id}`)} style={{ cursor: "pointer" }}>
                      <td>
                        <span style={{ marginRight: 6 }}>{tx.type === "send" ? "💸" : tx.type === "deposit" ? "💰" : tx.type === "exchange" ? "💱" : "📜"}</span>
                        <span style={{ textTransform: "capitalize" }}>{tx.type}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: tx.type === "deposit" ? "#1B9E5A" : "var(--text)" }}>
                        {tx.type === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td><span className={`badge ${tx.status === "completed" || tx.status === "success" ? "badge-success" : tx.status === "failed" ? "badge-error" : "badge-warning"}`}>{tx.status}</span></td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description || "—"}</td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
