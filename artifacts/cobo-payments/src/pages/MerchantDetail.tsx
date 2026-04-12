import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useLocation } from "wouter";
import api from "../lib/api";

export default function MerchantDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [merchant, setMerchant] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    Promise.all([
      api.get(`/merchants/${id}`).then(({ data }) => setMerchant(data)).catch(() => {}),
      api.get(`/transactions?merchantId=${id}&limit=10`).then(({ data }) => {
        setTransactions(Array.isArray(data) ? data : data.data || []);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const { data } = await api.put(`/merchants/${id}`, { status: newStatus });
      setMerchant(data);
    } catch {}
    setUpdating(false);
  };

  if (loading) {
    return <Layout><div className="page fade-in"><div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div></div></Layout>;
  }

  if (!merchant) {
    return (
      <Layout>
        <div className="page fade-in" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: 8 }}>Merchant Not Found</h2>
          <button className="btn btn-primary" onClick={() => setLocation("/merchants")}>Back to Merchants</button>
        </div>
      </Layout>
    );
  }

  const statusBadge = (status: string) => {
    const cls = status === "active" ? "badge-success" : status === "suspended" ? "badge-error" : status === "completed" || status === "success" ? "badge-success" : status === "failed" ? "badge-error" : "badge-warning";
    return <span className={`badge ${cls}`} style={{ textTransform: "capitalize" }}>{status}</span>;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days > 365) return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? "s" : ""} ago`;
    if (days > 30) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return "just now";
  };

  const infoRows = [
    { label: "Email", value: merchant.email },
    { label: "Phone", value: merchant.phone || "—" },
    { label: "Country", value: merchant.country },
    { label: "Business Type", value: merchant.businessType || "—" },
    { label: "Joined", value: timeAgo(merchant.createdAt) },
  ];

  return (
    <Layout>
      <div className="page fade-in" style={{ maxWidth: 800 }}>
        <button className="btn btn-ghost" onClick={() => setLocation("/merchants")} style={{ marginBottom: 16, gap: 6 }}>
          ← Back to Merchants
        </button>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
          <div className="card-lg" style={{ flex: "1 1 440px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 20,
              }}>{merchant.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20 }}>{merchant.name}</h2>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{merchant.email}</div>
              </div>
              {statusBadge(merchant.status)}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {infoRows.map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < infoRows.length - 1 ? "1px solid var(--surface2)" : "none" }}>
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--surface2)" }}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>Update Status</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["active", "pending", "suspended"].map(s => (
                  <button key={s} className={`btn btn-sm ${merchant.status === s ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => updateStatus(s)} disabled={updating || merchant.status === s}
                    style={{ textTransform: "capitalize", fontSize: 12 }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 200, flex: "0 0 auto" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>💰</div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, color: "var(--gold)" }}>
                ${(merchant.totalVolume ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Total Volume</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>📊</div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22 }}>
                {merchant.transactionCount ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Transactions</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent Transactions</h3>
          {transactions.length === 0 ? (
            <div className="empty"><div className="empty-icon">📜</div><div className="empty-desc">No transactions for this merchant</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Reference</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} onClick={() => setLocation(`/transactions/${tx.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{tx.reference}</td>
                      <td style={{ textTransform: "capitalize" }}>{tx.type}</td>
                      <td style={{ fontWeight: 600 }}>{tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td>{statusBadge(tx.status)}</td>
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
