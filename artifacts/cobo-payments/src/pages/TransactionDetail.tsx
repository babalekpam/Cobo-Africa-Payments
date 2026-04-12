import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useLocation } from "wouter";
import api from "../lib/api";

export default function TransactionDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/transactions/${id}`).then(({ data }) => {
      setTx(data.data || data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const copyRef = () => {
    if (tx?.reference) {
      navigator.clipboard.writeText(tx.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const viewReceipt = () => {
    const token = localStorage.getItem("cobo_token");
    window.open(`/api/exports/receipt/${id}?token=${token}`, "_blank");
  };

  if (loading) {
    return <Layout><div className="page fade-in"><div style={{ textAlign: "center", padding: 60 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div></div></Layout>;
  }

  if (!tx) {
    return (
      <Layout>
        <div className="page fade-in" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, marginBottom: 8 }}>Transaction Not Found</h2>
          <button className="btn btn-primary" onClick={() => setLocation("/transactions")}>Back to Transactions</button>
        </div>
      </Layout>
    );
  }

  const statusClass = tx.status === "completed" || tx.status === "success" ? "badge-success" : tx.status === "failed" ? "badge-error" : "badge-warning";
  const typeIcon = tx.type === "send" ? "💸" : tx.type === "deposit" ? "💰" : tx.type === "exchange" ? "💱" : "📜";

  const rows = [
    { label: "Reference", value: tx.reference },
    { label: "Type", value: tx.type },
    { label: "Amount", value: `${tx.currency} ${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
    { label: "Status", value: tx.status },
    { label: "Payment Method", value: tx.paymentMethod || "—" },
    { label: "Description", value: tx.description || "—" },
    { label: "Created", value: new Date(tx.createdAt).toLocaleString() },
  ];

  return (
    <Layout>
      <div className="page fade-in" style={{ maxWidth: 600 }}>
        <button className="btn btn-ghost" onClick={() => setLocation("/transactions")} style={{ marginBottom: 16, gap: 6 }}>
          ← Back to Transactions
        </button>

        <div className="card-lg">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32 }}>{typeIcon}</span>
              <div>
                <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20, marginBottom: 2 }}>Transaction Detail</h2>
                <span className={`badge ${statusClass}`} style={{ textTransform: "capitalize" }}>{tx.status}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 24, color: tx.type === "deposit" ? "#1B9E5A" : "var(--text)" }}>
                {tx.type === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--surface2)" : "none" }}>
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{row.label}</span>
                <span style={{
                  fontSize: 13, fontWeight: 500, color: "var(--text)", textAlign: "right", maxWidth: 300,
                  fontFamily: row.label === "Reference" ? "monospace" : "inherit",
                  textTransform: row.label === "Type" || row.label === "Status" ? "capitalize" : "none",
                }}>
                  {row.label === "Status" ? <span className={`badge ${statusClass}`}>{row.value}</span> : row.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={copyRef} style={{ gap: 6 }}>
              {copied ? "✓ Copied" : "📋 Copy Reference"}
            </button>
            <button className="btn btn-primary" onClick={viewReceipt} style={{ gap: 6 }}>
              🧾 View Receipt
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
