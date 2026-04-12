import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "users" | "transactions">("overview");

  useEffect(() => {
    Promise.all([
      api.get("/users").then(({ data }) => setUsers(Array.isArray(data) ? data : data.users || [])).catch(() => {}),
      api.get("/dashboard").then(({ data }) => setStats(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (user?.role !== "admin") {
    return <Layout><div className="page"><div className="card"><div className="empty"><div className="empty-icon">🔒</div><div className="empty-title">Access Denied</div><div className="empty-desc">Admin access required</div></div></div></div></Layout>;
  }

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: "📊" },
    { key: "users" as const, label: "Users", icon: "👥" },
    { key: "transactions" as const, label: "Transactions", icon: "📜" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">System management and oversight</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {tabs.map(t => <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t.key)}>{t.icon} {t.label}</button>)}
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
