import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

interface DepositRequest {
  id: number;
  userId: number;
  currency: string;
  amount: number;
  method: string;
  reference: string;
  bankName: string | null;
  senderName: string | null;
  senderAccount: string | null;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "users" | "transactions" | "deposits">("overview");
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositFilter, setDepositFilter] = useState("pending");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/users").then(({ data }) => setUsers(Array.isArray(data) ? data : data.users || [])).catch(() => {}),
      api.get("/dashboard").then(({ data }) => setStats(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const fetchDeposits = async () => {
    setDepositsLoading(true);
    try {
      const res = await api.get(`/admin/deposits?status=${depositFilter}`);
      setDeposits(res.data.deposits || []);
    } catch {}
    setDepositsLoading(false);
  };

  useEffect(() => {
    if (tab === "deposits") fetchDeposits();
  }, [tab, depositFilter]);

  const approveDeposit = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/admin/deposits/${id}/approve`);
      fetchDeposits();
    } catch {}
    setActionLoading(null);
  };

  const rejectDeposit = async (id: number) => {
    setActionLoading(id);
    try {
      await api.post(`/admin/deposits/${id}/reject`, { reason: rejectReason || "Payment not verified" });
      setRejectId(null);
      setRejectReason("");
      fetchDeposits();
    } catch {}
    setActionLoading(null);
  };

  if (user?.role !== "admin") {
    return <Layout><div className="page"><div className="card"><div className="empty"><div className="empty-icon">🔒</div><div className="empty-title">Access Denied</div><div className="empty-desc">Admin access required</div></div></div></div></Layout>;
  }

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: "📊" },
    { key: "users" as const, label: "Users", icon: "👥" },
    { key: "deposits" as const, label: "Deposits", icon: "🏦" },
    { key: "transactions" as const, label: "Transactions", icon: "📜" },
  ];

  const pendingCount = deposits.filter(d => d.status === "pending").length;

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: "rgba(201,138,26,0.1)", color: "#C98A1A" },
      approved: { bg: "rgba(27,158,90,0.1)", color: "#1B9E5A" },
      rejected: { bg: "rgba(217,54,54,0.1)", color: "#D93636" },
    };
    const c = colors[status] || colors.pending;
    return <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, textTransform: "capitalize" }}>{status}</span>;
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">System management and oversight</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t.key)} style={{ position: "relative" }}>
              {t.icon} {t.label}
              {t.key === "deposits" && pendingCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#D93636", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : (
          <>
            {tab === "overview" && (
              <div className="grid-4" style={{ marginBottom: 28 }}>
                <div className="stat-card"><div className="stat-card-icon">👥</div><div className="stat-card-label">Total Users</div><div className="stat-card-value">{users.length}</div></div>
                <div className="stat-card"><div className="stat-card-icon">✅</div><div className="stat-card-label">Active Users</div><div className="stat-card-value">{users.filter(u => u.status === "active").length}</div></div>
                <div className="stat-card"><div className="stat-card-icon">🏛️</div><div className="stat-card-label">Admins</div><div className="stat-card-value">{users.filter(u => u.role === "admin").length}</div></div>
                <div className="stat-card"><div className="stat-card-icon">📊</div><div className="stat-card-label">Transactions</div><div className="stat-card-value">{stats?.totalTransactions ?? "—"}</div></div>
              </div>
            )}

            {tab === "users" && (
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Country</th><th>Joined</th></tr></thead>
                    <tbody>
                      {users.map((u: any) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td style={{ color: "var(--text-dim)" }}>{u.email}</td>
                          <td><span className={`badge ${u.role === "admin" ? "badge-warning" : "badge-dim"}`}>{u.role}</span></td>
                          <td><span className={`badge ${u.status === "active" ? "badge-success" : "badge-error"}`}>{u.status}</span></td>
                          <td>{u.country || "—"}</td>
                          <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "deposits" && (
              <div className="card-lg">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, margin: 0 }}>Deposit Requests</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["pending", "approved", "rejected"].map(s => (
                      <button key={s} className={`btn ${depositFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setDepositFilter(s)} style={{ fontSize: 12, padding: "6px 14px", textTransform: "capitalize" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {depositsLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
                ) : deposits.length === 0 ? (
                  <div className="empty">
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                    <p>No {depositFilter} deposit requests.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>User ID</th>
                          <th>Amount</th>
                          <th>Sender</th>
                          <th>Bank</th>
                          <th>Status</th>
                          <th>Date</th>
                          {depositFilter === "pending" && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.map(d => (
                          <tr key={d.id}>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.reference}</td>
                            <td>#{d.userId}</td>
                            <td style={{ fontWeight: 700 }}>{d.currency} {d.amount.toLocaleString()}</td>
                            <td>{d.senderName || "—"}</td>
                            <td>
                              <div>{d.bankName || "—"}</div>
                              {d.senderAccount && <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "monospace" }}>{d.senderAccount}</div>}
                              {d.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{d.notes}</div>}
                            </td>
                            <td>
                              {statusBadge(d.status)}
                              {d.rejectionReason && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{d.rejectionReason}</div>}
                            </td>
                            <td style={{ fontSize: 13 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                            {depositFilter === "pending" && (
                              <td>
                                {rejectId === d.id ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                                    <input className="input" placeholder="Rejection reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ fontSize: 12, padding: "6px 10px" }} />
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button className="btn" style={{ fontSize: 11, padding: "4px 10px", background: "#D93636", color: "#fff", border: "none", borderRadius: 6 }} onClick={() => rejectDeposit(d.id)} disabled={actionLoading === d.id}>
                                        {actionLoading === d.id ? "..." : "Confirm"}
                                      </button>
                                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "#1B9E5A", color: "#fff", border: "none", borderRadius: 6 }} onClick={() => approveDeposit(d.id)} disabled={actionLoading === d.id}>
                                      {actionLoading === d.id ? "..." : "✓ Approve"}
                                    </button>
                                    <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "#D93636", color: "#fff", border: "none", borderRadius: 6 }} onClick={() => setRejectId(d.id)}>
                                      ✕ Reject
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "transactions" && (
              <div className="card">
                <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">Transaction Management</div><div className="empty-desc">View global transactions from the Transactions page</div></div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
