import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import api from "../lib/api";

const COLORS = ["#1B9E5A", "#C98A1A", "#2A7CC7", "#8B5CF6", "#D93636", "#0EA5A2", "#E67E22"];

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/auth/dashboard").then(({ data }) => {
        setStats(data.stats);
        setTransactions(data.recent_transactions || []);
      }).catch(() => {}),
      api.get("/merchants").then(({ data }) => {
        setMerchants(data.data || data || []);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const statusBreakdown = (() => {
    const counts: Record<string, number> = {};
    transactions.forEach(tx => { counts[tx.status] = (counts[tx.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const typeBreakdown = (() => {
    const sums: Record<string, number> = {};
    transactions.forEach(tx => { sums[tx.type] = (sums[tx.type] || 0) + Number(tx.amount || 0); });
    return Object.entries(sums).map(([name, value]) => ({ name, value: Math.round(value) }));
  })();
  const maxTypeVal = Math.max(...typeBreakdown.map(t => t.value), 1);

  const paymentMethodBreakdown = (() => {
    const counts: Record<string, number> = {};
    transactions.forEach(tx => { const m = tx.paymentMethod || "Other"; counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  })();
  const maxMethodVal = Math.max(...paymentMethodBreakdown.map(p => p.value), 1);

  const countryBreakdown = (() => {
    const sums: Record<string, { volume: number; count: number }> = {};
    transactions.forEach(tx => {
      const c = tx.country || "Unknown";
      if (!sums[c]) sums[c] = { volume: 0, count: 0 };
      sums[c].volume += Number(tx.amount || 0);
      sums[c].count++;
    });
    return Object.entries(sums).map(([country, d]) => ({ country, ...d })).sort((a, b) => b.volume - a.volume);
  })();
  const maxCountryVol = Math.max(...countryBreakdown.map(c => c.volume), 1);

  const topMerchants = [...merchants].sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0)).slice(0, 10);
  const totalMerchantVol = topMerchants.reduce((s, m) => s + (m.totalVolume || 0), 0);

  const totalStatusCount = statusBreakdown.reduce((s, e) => s + e.value, 0);
  const successRate = totalStatusCount > 0
    ? Math.round((statusBreakdown.find(s => s.name === "completed" || s.name === "success")?.value || 0) / totalStatusCount * 100)
    : 0;

  const formatAmount = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`;

  const exportReport = () => {
    const lines = [
      "IAPAY (Inter-Africa Pay) - Report",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "=== Summary ===",
      `Total Volume: ${formatAmount(stats?.total_volume ?? 0)}`,
      `Total Transactions: ${stats?.total_transactions ?? 0}`,
      `Success Rate: ${successRate}%`,
      `Active Merchants: ${merchants.filter(m => m.status === "active").length}`,
      "",
      "=== Volume by Type ===",
      ...typeBreakdown.map(t => `${t.name}: ${formatAmount(t.value)}`),
      "",
      "=== Top Merchants ===",
      ...topMerchants.map((m, i) => `${i + 1}. ${m.name} - ${formatAmount(m.totalVolume || 0)} (${m.transactionCount || 0} txns)`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobo-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Layout><div className="page fade-in"><div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div></div></Layout>;
  }

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Reports & Analytics</h1>
            <p className="page-subtitle">Detailed platform performance data</p>
          </div>
          <button className="btn btn-ghost" onClick={exportReport} style={{ gap: 6 }}>
            📥 Export Report
          </button>
        </div>

        <div className="grid-4" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-label">Total Volume</div>
            <div className="stat-card-value" style={{ color: "var(--gold)" }}>{formatAmount(stats?.total_volume ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-label">Transactions</div>
            <div className="stat-card-value">{stats?.total_transactions ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📈</div>
            <div className="stat-card-label">Success Rate</div>
            <div className="stat-card-value" style={{ color: "var(--green)" }}>{successRate}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🌍</div>
            <div className="stat-card-label">Countries</div>
            <div className="stat-card-value">{countryBreakdown.length}</div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Transaction Status</h3>
            {statusBreakdown.length === 0 ? (
              <div className="empty"><div className="empty-desc">No data</div></div>
            ) : (
              <>
                <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
                  {statusBreakdown.map((entry, i) => (
                    <div key={entry.name} style={{
                      flex: entry.value, background: COLORS[i % COLORS.length],
                      transition: "flex 0.5s ease",
                    }} title={`${entry.name}: ${entry.value}`} />
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {statusBreakdown.map((entry, i) => (
                    <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                      <span style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "capitalize" }}>{entry.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Volume by Type</h3>
            {typeBreakdown.length === 0 ? (
              <div className="empty"><div className="empty-desc">No data</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {typeBreakdown.map((t, i) => (
                  <div key={t.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, textTransform: "capitalize" }}>{t.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{formatAmount(t.value)}</span>
                    </div>
                    <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(t.value / maxTypeVal) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Volume by Country</h3>
            {countryBreakdown.length === 0 ? (
              <div className="empty"><div className="empty-desc">No data</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {countryBreakdown.slice(0, 8).map((c, i) => (
                  <div key={c.country}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{c.country}</span>
                      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.count} txns · {formatAmount(c.volume)}</span>
                    </div>
                    <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(c.volume / maxCountryVol) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Payment Methods</h3>
            {paymentMethodBreakdown.length === 0 ? (
              <div className="empty"><div className="empty-desc">No data</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {paymentMethodBreakdown.slice(0, 8).map((pm, i) => (
                  <div key={pm.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{pm.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{pm.value} txns</span>
                    </div>
                    <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(pm.value / maxMethodVal) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 4, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Top Merchants by Volume</h3>
          {topMerchants.length === 0 ? (
            <div className="empty"><div className="empty-icon">🏪</div><div className="empty-desc">No merchants</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Merchant</th><th>Country</th><th>Txns</th><th style={{ textAlign: "right" }}>Volume</th><th style={{ textAlign: "right" }}>Share</th></tr></thead>
                <tbody>
                  {topMerchants.map((m: any, i: number) => {
                    const share = totalMerchantVol > 0 ? ((m.totalVolume || 0) / totalMerchantVol * 100).toFixed(1) : "0";
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700, color: "var(--text-dim)" }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td style={{ color: "var(--text-dim)" }}>{m.country}</td>
                        <td>{m.transactionCount || 0}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--gold)" }}>{formatAmount(m.totalVolume || 0)}</td>
                        <td style={{ textAlign: "right", color: "var(--text-dim)" }}>{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
