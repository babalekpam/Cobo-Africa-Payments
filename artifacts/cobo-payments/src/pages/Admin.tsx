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
  const [tab, setTab] = useState<"overview" | "users" | "transactions" | "deposits" | "compliance" | "kyc">("overview");
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositFilter, setDepositFilter] = useState("pending");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [complianceData, setComplianceData] = useState<any>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [kycUsers, setKycUsers] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycFilter, setKycFilter] = useState("submitted");
  const [ofacQuery, setOfacQuery] = useState("");
  const [ofacResult, setOfacResult] = useState<any>(null);
  const [ofacLoading, setOfacLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/users").then(({ data }) => setUsers(Array.isArray(data) ? data : data.data || data.users || [])).catch(() => {}),
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

  const fetchCompliance = async () => {
    setComplianceLoading(true);
    try {
      const res = await api.get("/compliance/overview");
      setComplianceData(res.data);
    } catch {}
    setComplianceLoading(false);
  };

  const fetchKycUsers = async () => {
    setKycLoading(true);
    try {
      const filtered = users.filter(u => {
        if (kycFilter === "submitted") return u.kycStatus === "submitted";
        if (kycFilter === "verified") return u.kycStatus === "verified";
        if (kycFilter === "rejected") return u.kycStatus === "rejected";
        return true;
      });
      setKycUsers(filtered);
    } catch {}
    setKycLoading(false);
  };

  const runOfacScreen = async () => {
    if (!ofacQuery.trim()) return;
    setOfacLoading(true);
    try {
      const res = await api.post("/compliance/screen", { name: ofacQuery.trim() });
      const screening = res.data.screening || res.data;
      setOfacResult({ clear: screening.result === "clear", matches: screening.matches || [], riskScore: screening.risk_score || 0 });
    } catch { setOfacResult({ error: true }); }
    setOfacLoading(false);
  };

  const approveKyc = async (userId: number, level: number) => {
    setActionLoading(userId);
    try {
      await api.post(`/compliance/kyc/${userId}/review`, { action: "approve", level });
      const { data } = await api.get("/users");
      setUsers(Array.isArray(data) ? data : data.data || data.users || []);
      fetchKycUsers();
    } catch {}
    setActionLoading(null);
  };

  const rejectKyc = async (userId: number) => {
    setActionLoading(userId);
    try {
      await api.post(`/compliance/kyc/${userId}/review`, { action: "reject", reason: "Documents insufficient" });
      const { data } = await api.get("/users");
      setUsers(Array.isArray(data) ? data : data.data || data.users || []);
      fetchKycUsers();
    } catch {}
    setActionLoading(null);
  };

  useEffect(() => {
    if (tab === "deposits") fetchDeposits();
  }, [tab, depositFilter]);

  useEffect(() => {
    if (tab === "compliance") fetchCompliance();
  }, [tab]);

  useEffect(() => {
    if (tab === "kyc") fetchKycUsers();
  }, [tab, kycFilter, users]);

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

  const submittedKycCount = users.filter(u => u.kycStatus === "submitted").length;
  const pendingDepositCount = deposits.filter(d => d.status === "pending").length;

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: "📊" },
    { key: "users" as const, label: "Users", icon: "👥" },
    { key: "deposits" as const, label: "Deposits", icon: "🏦" },
    { key: "kyc" as const, label: "KYC Review", icon: "🪪" },
    { key: "compliance" as const, label: "Compliance", icon: "🛡️" },
    { key: "transactions" as const, label: "Transactions", icon: "📜" },
  ];

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      pending: { bg: "rgba(201,138,26,0.1)", color: "#C98A1A" },
      submitted: { bg: "rgba(59,130,246,0.1)", color: "#3B82F6" },
      approved: { bg: "rgba(27,158,90,0.1)", color: "#1B9E5A" },
      verified: { bg: "rgba(27,158,90,0.1)", color: "#1B9E5A" },
      rejected: { bg: "rgba(217,54,54,0.1)", color: "#D93636" },
      unverified: { bg: "rgba(150,150,150,0.1)", color: "#999" },
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
              {t.key === "deposits" && pendingDepositCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#D93636", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendingDepositCount}</span>
              )}
              {t.key === "kyc" && submittedKycCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#3B82F6", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{submittedKycCount}</span>
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
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>KYC</th><th>Status</th><th>Country</th><th>Joined</th></tr></thead>
                    <tbody>
                      {users.map((u: any) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td style={{ color: "var(--text-dim)" }}>{u.email}</td>
                          <td><span className={`badge ${u.role === "admin" ? "badge-warning" : "badge-dim"}`}>{u.role}</span></td>
                          <td>{statusBadge(u.kycStatus || "unverified")} <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 4 }}>L{u.kycLevel || 0}</span></td>
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
                                      {actionLoading === d.id ? "..." : "Approve"}
                                    </button>
                                    <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "#D93636", color: "#fff", border: "none", borderRadius: 6 }} onClick={() => setRejectId(d.id)}>
                                      Reject
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

            {tab === "kyc" && (
              <div className="card-lg">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, margin: 0 }}>KYC Document Review</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["submitted", "verified", "rejected", "all"].map(s => (
                      <button key={s} className={`btn ${kycFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setKycFilter(s)} style={{ fontSize: 12, padding: "6px 14px", textTransform: "capitalize" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {kycLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
                ) : kycUsers.length === 0 ? (
                  <div className="empty">
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🪪</div>
                    <p>No {kycFilter === "all" ? "" : kycFilter} KYC submissions.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>User</th><th>Email</th><th>KYC Level</th><th>Status</th><th>Country</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {kycUsers.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{u.email}</td>
                            <td style={{ fontWeight: 600 }}>Level {u.kycLevel || 0}</td>
                            <td>{statusBadge(u.kycStatus || "unverified")}</td>
                            <td>{u.country || "—"}</td>
                            <td>
                              {u.kycStatus === "submitted" ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button className="btn" style={{ fontSize: 12, padding: "6px 12px", background: "#1B9E5A", color: "#fff", border: "none", borderRadius: 6 }} onClick={() => approveKyc(u.id, Math.min((u.kycLevel || 0) + 1, 2))} disabled={actionLoading === u.id}>
                                    {actionLoading === u.id ? "..." : `Approve L${Math.min((u.kycLevel || 0) + 1, 2)}`}
                                  </button>
                                  <button className="btn" style={{ fontSize: 12, padding: "6px 12px", background: "#D93636", color: "#fff", border: "none", borderRadius: 6 }} onClick={() => rejectKyc(u.id)} disabled={actionLoading === u.id}>
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No action needed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "compliance" && (
              <div>
                <div className="grid-3" style={{ marginBottom: 24 }}>
                  <div className="stat-card">
                    <div className="stat-card-icon">🛡️</div>
                    <div className="stat-card-label">BSA/AML Status</div>
                    <div className="stat-card-value" style={{ color: "#1B9E5A", fontSize: 18 }}>Active</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">🔍</div>
                    <div className="stat-card-label">OFAC Screenings</div>
                    <div className="stat-card-value">{complianceData?.screeningsToday ?? "—"}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">📋</div>
                    <div className="stat-card-label">Pending CTRs</div>
                    <div className="stat-card-value">{complianceData?.pendingCtrs ?? "—"}</div>
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 24 }}>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>OFAC/SDN Quick Screen</h3>
                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
                      Screen names, entities, or organizations against the OFAC Specially Designated Nationals (SDN) list.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                      <input className="input" value={ofacQuery} onChange={e => setOfacQuery(e.target.value)} placeholder="Enter name to screen..." style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && runOfacScreen()} />
                      <button className="btn btn-primary" onClick={runOfacScreen} disabled={ofacLoading || !ofacQuery.trim()}>
                        {ofacLoading ? <span className="spinner" /> : "Screen"}
                      </button>
                    </div>
                    {ofacResult && !ofacResult.error && (
                      <div style={{ padding: 16, background: ofacResult.clear ? "rgba(27,158,90,0.06)" : "rgba(217,54,54,0.06)", borderRadius: 10, border: `1px solid ${ofacResult.clear ? "rgba(27,158,90,0.2)" : "rgba(217,54,54,0.2)"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>{ofacResult.clear ? "✅" : "🚨"}</span>
                          <span style={{ fontWeight: 700, color: ofacResult.clear ? "#1B9E5A" : "#D93636" }}>
                            {ofacResult.clear ? "No matches found" : `${ofacResult.matches?.length || 0} potential match(es)`}
                          </span>
                        </div>
                        {ofacResult.matches?.map((m: any, i: number) => (
                          <div key={i} style={{ padding: "8px 12px", background: "rgba(217,54,54,0.05)", borderRadius: 6, marginTop: 8, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{m.entry}</div>
                            <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 2 }}>Score: {m.score}% | Type: {m.matchType}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Compliance Quick Links</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "BSA/AML Policy", desc: "View full Bank Secrecy Act / Anti-Money Laundering policy", href: "/aml-policy", icon: "📜" },
                        { label: "Compliance Center", desc: "CTR management, SAR reports, EDD reviews", href: "/compliance", icon: "🛡️" },
                        { label: "KYC Review Queue", desc: `${submittedKycCount} pending submissions`, action: () => setTab("kyc"), icon: "🪪" },
                      ].map((link, i) => (
                        <div key={i} onClick={link.action || (() => { window.location.hash = link.href || ""; })}
                          style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--surface2)", borderRadius: 10, cursor: "pointer", transition: "background 0.15s" }}
                          onMouseOver={e => (e.currentTarget.style.background = "var(--surface3)")}
                          onMouseOut={e => (e.currentTarget.style.background = "var(--surface2)")}>
                          <div style={{ fontSize: 24 }}>{link.icon}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{link.label}</div>
                            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{link.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 20, padding: 16, background: "rgba(27,158,90,0.05)", borderRadius: 10, border: "1px solid rgba(27,158,90,0.15)" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#1B9E5A" }}>MSB Registration</div>
                      <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                        COBO Africa Payments is registered as a Money Services Business (MSB) with the US Financial Crimes Enforcement Network (FinCEN). Our compliance program covers BSA/AML, CTR filing, SAR reporting, OFAC screening, and Enhanced Due Diligence.
                      </div>
                    </div>
                  </div>
                </div>

                {complianceLoading && <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div>}
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
