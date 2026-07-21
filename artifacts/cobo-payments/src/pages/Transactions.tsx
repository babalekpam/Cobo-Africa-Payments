import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useLocation } from "wouter";
import api from "../lib/api";

export default function Transactions() {
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", type: "" });
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.type) params.set("type", filter.type);
    api.get(`/transactions?${params}`).then(({ data }) => {
      const list = Array.isArray(data) ? data : (data.data || data.transactions || []);
      setTxs(list);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  const exportCSV = () => {
    const token = localStorage.getItem("iapay_token");
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.type) params.set("type", filter.type);
    window.open(`/api/exports/transactions.csv?${params}&token=${token}`, "_blank");
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Transactions</h1>
            <p className="page-subtitle">View all your transaction history</p>
          </div>
          <button className="btn btn-ghost" onClick={exportCSV} style={{ gap: 6 }}>
            📥 Export CSV
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <select className="select" style={{ width: 160 }} value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select className="select" style={{ width: 160 }} value={filter.type} onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
            <option value="">All Types</option>
            <option value="payment">Payment</option>
            <option value="send">Send</option>
            <option value="deposit">Deposit</option>
            <option value="exchange">Exchange</option>
          </select>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
          ) : txs.length === 0 ? (
            <div className="empty"><div className="empty-icon">📜</div><div className="empty-title">No transactions</div><div className="empty-desc">Your transaction history will appear here</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Reference</th><th>Type</th><th>Amount</th><th>Status</th><th>Description</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {txs.map((tx: any) => (
                    <tr key={tx.id} onClick={() => setLocation(`/transactions/${tx.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{tx.reference}</td>
                      <td>
                        <span style={{ marginRight: 4 }}>{tx.type === "send" ? "💸" : tx.type === "deposit" ? "💰" : tx.type === "exchange" ? "💱" : "📜"}</span>
                        <span style={{ textTransform: "capitalize" }}>{tx.type}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: tx.type === "deposit" ? "#1B9E5A" : "var(--text)" }}>
                        {tx.type === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td><span className={`badge ${tx.status === "completed" || tx.status === "success" ? "badge-success" : tx.status === "failed" ? "badge-error" : "badge-warning"}`}>{tx.status}</span></td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description || tx.paymentMethod || "—"}</td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); const token = localStorage.getItem("iapay_token"); window.open(`/api/exports/receipt/${tx.id}?token=${token}`, "_blank"); }} title="View Receipt" style={{ padding: "4px 8px", fontSize: 12 }}>
                          🧾
                        </button>
                      </td>
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
