import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

type Tab = "overview" | "kyc" | "screening" | "sar";

export default function Compliance() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [kycQueue, setKycQueue] = useState<any[]>([]);
  const [screenings, setScreenings] = useState<any[]>([]);
  const [sars, setSars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenForm, setScreenForm] = useState({ name: "", country: "" });
  const [screenResult, setScreenResult] = useState<any>(null);
  const [screening, setScreening] = useState(false);
  const [sarForm, setSarForm] = useState({ user_id: "", report_type: "unusual_activity", description: "", risk_level: "medium" });
  const [sarFiling, setSarFiling] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/compliance/stats").then(({ data }) => setStats(data.stats)).catch(() => {}),
      api.get("/compliance/kyc-queue").then(({ data }) => setKycQueue(data.queue || [])).catch(() => {}),
      api.get("/compliance/screening-log").then(({ data }) => setScreenings(data.screenings || [])).catch(() => {}),
      api.get("/compliance/sar").then(({ data }) => setSars(data.reports || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (user?.role !== "admin") {
    return <Layout><div className="page"><div className="card"><div className="empty"><div className="empty-icon">🔒</div><div className="empty-title">Access Denied</div><div className="empty-desc">Compliance officer access required</div></div></div></div></Layout>;
  }

  const runScreen = async () => {
    setScreening(true); setScreenResult(null);
    try {
      const { data } = await api.post("/compliance/screen", { name: screenForm.name, country: screenForm.country, screen_type: "manual" });
      setScreenResult(data.screening);
      load();
    } catch { setScreenResult({ error: true }); }
    setScreening(false);
  };

  const reviewKYC = async (docId: number, action: "approve" | "reject", newLevel?: number, reason?: string) => {
    setReviewingId(docId);
    try {
      await api.put(`/compliance/kyc/${docId}/review`, { action, new_kyc_level: newLevel, rejection_reason: reason });
      load();
    } catch (err: any) { alert(err.response?.data?.message || "Review failed"); }
    setReviewingId(null);
  };

  const fileSAR = async () => {
    setSarFiling(true);
    try {
      await api.post("/compliance/sar", sarForm);
      setSarForm({ user_id: "", report_type: "unusual_activity", description: "", risk_level: "medium" });
      load();
    } catch (err: any) { alert(err.response?.data?.message || "Filing failed"); }
    setSarFiling(false);
  };

  const resolveSAR = async (id: number) => {
    const notes = prompt("Resolution notes:");
    if (!notes) return;
    try {
      await api.put(`/compliance/sar/${id}/resolve`, { resolution_notes: notes });
      load();
    } catch (err: any) { alert(err.response?.data?.message || "Failed"); }
  };

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: "📊" },
    { key: "kyc" as const, label: "KYC Review", icon: "🛡️" },
    { key: "screening" as const, label: "Sanctions Screening", icon: "🔍" },
    { key: "sar" as const, label: "SAR Reports", icon: "🚨" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Compliance Center</h1>
          <p className="page-subtitle">KYC review, sanctions screening, and suspicious activity reporting</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {tabs.map(t => <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t.key)}>{t.icon} {t.label}</button>)}
        </div>

        {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : (
          <>
            {tab === "overview" && stats && (
              <>
                <div className="grid-4" style={{ marginBottom: 28 }}>
                  <div className="stat-card">
                    <div className="stat-card-icon">🛡️</div>
                    <div className="stat-card-label">KYC Pending</div>
                    <div className="stat-card-value">{stats.kyc.pending_docs}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">✅</div>
                    <div className="stat-card-label">Verified Users</div>
                    <div className="stat-card-value">{stats.kyc.verified_users} / {stats.kyc.total_users}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">🔍</div>
                    <div className="stat-card-label">Screenings (30d)</div>
                    <div className="stat-card-value">{stats.screenings.recent_30d}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-icon">🚨</div>
                    <div className="stat-card-label">Open SARs</div>
                    <div className="stat-card-value" style={{ color: stats.sar.open > 0 ? "#dc3545" : "inherit" }}>{stats.sar.open}</div>
                  </div>
                </div>

                <div className="grid-2" style={{ marginBottom: 28 }}>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Sanctions Screening Summary</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                        <span>Total Screenings</span><span style={{ fontWeight: 700 }}>{stats.screenings.total}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: stats.screenings.flagged > 0 ? "rgba(220,53,69,0.08)" : "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                        <span>Flagged</span><span style={{ fontWeight: 700, color: stats.screenings.flagged > 0 ? "#dc3545" : "inherit" }}>{stats.screenings.flagged}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                        <span>Clear Rate</span><span style={{ fontWeight: 700 }}>{stats.screenings.total > 0 ? Math.round(((stats.screenings.total - stats.screenings.flagged) / stats.screenings.total) * 100) : 100}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>KYC Level Distribution</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {(stats.kyc.by_level || []).map((l: any) => (
                        <div key={l.level} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)" }}>
                          <span>Level {l.level} {l.level === "0" ? "(Unverified)" : l.level === "1" ? "(Basic)" : "(Full)"}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--border)" }}>
                              <div style={{ width: `${stats.kyc.total_users > 0 ? (l.count / stats.kyc.total_users) * 100 : 0}%`, height: "100%", borderRadius: 3, background: l.level === "0" ? "#dc3545" : l.level === "1" ? "#C98A1A" : "#28a745" }} />
                            </div>
                            <span style={{ fontWeight: 700, minWidth: 24, textAlign: "right" }}>{l.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card-lg">
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>SAR Summary</h3>
                  <div className="grid-3">
                    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.sar.total}</div>
                      <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Total Reports Filed</div>
                    </div>
                    <div style={{ padding: "16px", background: stats.sar.open > 0 ? "rgba(220,53,69,0.08)" : "var(--surface2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: stats.sar.open > 0 ? "#dc3545" : "inherit" }}>{stats.sar.open}</div>
                      <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Open / Under Review</div>
                    </div>
                    <div style={{ padding: "16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#28a745" }}>{stats.sar.total - stats.sar.open}</div>
                      <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Resolved</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "kyc" && (
              <>
                <div className="card-lg" style={{ marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
                    Pending KYC Documents ({kycQueue.length})
                  </h3>
                  {kycQueue.length === 0 ? (
                    <div className="empty" style={{ padding: 30 }}><div className="empty-icon">✅</div><div className="empty-title">All Clear</div><div className="empty-desc">No pending KYC documents to review</div></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {kycQueue.map((doc: any) => (
                        <div key={doc.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{doc.user_name}</div>
                              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{doc.user_email} {doc.user_country ? `• ${doc.user_country}` : ""}</div>
                              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>Current Level: {doc.kyc_level || 0} • Status: {doc.kyc_status}</div>
                            </div>
                            <span className="badge badge-warning">Pending Review</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius-sm)", marginBottom: 12 }}>
                            <span style={{ fontSize: 20 }}>📄</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>{(doc.docType || "").replace(/_/g, " ")}</div>
                              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Doc #: {doc.docUrl}</div>
                              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Submitted: {new Date(doc.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-primary" style={{ fontSize: 13 }} disabled={reviewingId === doc.id}
                              onClick={() => {
                                const newLevel = Number(doc.kyc_level || 0) + 1;
                                reviewKYC(doc.id, "approve", Math.min(newLevel, 2));
                              }}>
                              {reviewingId === doc.id ? <span className="spinner" /> : `✓ Approve → Level ${Math.min(Number(doc.kyc_level || 0) + 1, 2)}`}
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: 13, color: "#dc3545" }} disabled={reviewingId === doc.id}
                              onClick={() => {
                                const reason = prompt("Rejection reason:");
                                if (reason) reviewKYC(doc.id, "reject", undefined, reason);
                              }}>
                              ✗ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "screening" && (
              <>
                <div className="grid-2" style={{ marginBottom: 24 }}>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Manual Screening</h3>
                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Screen a name against sanctions lists (OFAC, EU, UN)</p>
                    <div className="input-group" style={{ marginBottom: 12 }}>
                      <label className="input-label">Full Name</label>
                      <input className="input" value={screenForm.name} onChange={e => setScreenForm(p => ({ ...p, name: e.target.value }))} placeholder="Enter name to screen" />
                    </div>
                    <div className="input-group" style={{ marginBottom: 16 }}>
                      <label className="input-label">Country Code (optional)</label>
                      <input className="input" value={screenForm.country} onChange={e => setScreenForm(p => ({ ...p, country: e.target.value }))} placeholder="e.g. NG, US, KP" maxLength={2} />
                    </div>
                    <button className="btn btn-primary btn-full" onClick={runScreen} disabled={screening || !screenForm.name}>
                      {screening ? <span className="spinner" /> : "🔍 Run Screening"}
                    </button>

                    {screenResult && !screenResult.error && (
                      <div style={{ marginTop: 16, padding: 16, borderRadius: "var(--radius)", background: screenResult.result === "clear" ? "rgba(40,167,69,0.08)" : screenResult.result === "flagged" ? "rgba(220,53,69,0.08)" : "rgba(201,138,26,0.08)", border: `1px solid ${screenResult.result === "clear" ? "#28a745" : screenResult.result === "flagged" ? "#dc3545" : "#C98A1A"}` }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: screenResult.result === "clear" ? "#28a745" : screenResult.result === "flagged" ? "#dc3545" : "#C98A1A" }}>
                          {screenResult.result === "clear" ? "✅ CLEAR" : screenResult.result === "flagged" ? "🚨 FLAGGED" : "⚠️ REVIEW REQUIRED"}
                        </div>
                        <div style={{ fontSize: 13 }}>Risk Score: <strong>{screenResult.risk_score}/100</strong></div>
                        {screenResult.country_risk === "high" && <div style={{ fontSize: 13, color: "#dc3545", marginTop: 4 }}>High-risk country detected</div>}
                        {screenResult.matches?.length > 0 && <div style={{ fontSize: 13, marginTop: 4 }}>Matches: {screenResult.matches.join(", ")}</div>}
                      </div>
                    )}
                  </div>

                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>High-Risk Countries</h3>
                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Transfers to these jurisdictions trigger enhanced screening</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[
                        { code: "KP", name: "North Korea" }, { code: "IR", name: "Iran" },
                        { code: "SY", name: "Syria" }, { code: "CU", name: "Cuba" },
                        { code: "VE", name: "Venezuela" }, { code: "MM", name: "Myanmar" },
                        { code: "BY", name: "Belarus" }, { code: "RU", name: "Russia" },
                      ].map(c => (
                        <span key={c.code} style={{ padding: "6px 12px", background: "rgba(220,53,69,0.08)", color: "#dc3545", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {c.code} — {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card-lg">
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Recent Screening Log</h3>
                  {screenings.length === 0 ? (
                    <div className="empty" style={{ padding: 30 }}><div className="empty-desc">No screenings recorded yet</div></div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Name</th><th>Type</th><th>Result</th><th>Risk</th><th>Date</th></tr></thead>
                        <tbody>
                          {screenings.slice(0, 50).map((s: any) => (
                            <tr key={s.id}>
                              <td style={{ fontWeight: 600 }}>{s.screenedName}</td>
                              <td style={{ textTransform: "capitalize" }}>{s.screenType}</td>
                              <td>
                                <span className={`badge ${s.result === "clear" ? "badge-success" : s.result === "flagged" ? "badge-error" : "badge-warning"}`}>
                                  {s.result}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: s.riskScore >= 80 ? "#dc3545" : s.riskScore >= 40 ? "#C98A1A" : "#28a745" }}>
                                  {s.riskScore}/100
                                </span>
                              </td>
                              <td style={{ fontSize: 13, color: "var(--text-dim)" }}>{new Date(s.createdAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "sar" && (
              <>
                <div className="card-lg" style={{ marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>File New SAR</h3>
                  <div className="grid-2" style={{ marginBottom: 12 }}>
                    <div className="input-group">
                      <label className="input-label">User ID</label>
                      <input className="input" value={sarForm.user_id} onChange={e => setSarForm(p => ({ ...p, user_id: e.target.value }))} placeholder="User ID" type="number" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Report Type</label>
                      <select className="select" value={sarForm.report_type} onChange={e => setSarForm(p => ({ ...p, report_type: e.target.value }))}>
                        <option value="unusual_activity">Unusual Activity</option>
                        <option value="structuring">Structuring / Smurfing</option>
                        <option value="sanctions_match">Sanctions Match</option>
                        <option value="identity_fraud">Identity Fraud</option>
                        <option value="money_laundering">Money Laundering</option>
                        <option value="terrorist_financing">Terrorist Financing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-2" style={{ marginBottom: 12 }}>
                    <div className="input-group">
                      <label className="input-label">Risk Level</label>
                      <select className="select" value={sarForm.risk_level} onChange={e => setSarForm(p => ({ ...p, risk_level: e.target.value }))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Description</label>
                    <textarea className="input" style={{ minHeight: 80, resize: "vertical" }} value={sarForm.description} onChange={e => setSarForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the suspicious activity in detail..." />
                  </div>
                  <button className="btn btn-primary" onClick={fileSAR} disabled={sarFiling || !sarForm.user_id || !sarForm.description}>
                    {sarFiling ? <span className="spinner" /> : "🚨 File SAR"}
                  </button>
                </div>

                <div className="card-lg">
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
                    SAR Reports ({sars.length})
                  </h3>
                  {sars.length === 0 ? (
                    <div className="empty" style={{ padding: 30 }}><div className="empty-icon">📋</div><div className="empty-desc">No suspicious activity reports filed</div></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sars.map((sar: any) => (
                        <div key={sar.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: `1px solid ${sar.status === "open" ? "rgba(220,53,69,0.3)" : "var(--border)"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, textTransform: "capitalize" }}>{sar.reportType.replace(/_/g, " ")}</span>
                                <span className={`badge ${sar.riskLevel === "critical" ? "badge-error" : sar.riskLevel === "high" ? "badge-warning" : "badge-dim"}`}>{sar.riskLevel}</span>
                              </div>
                              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>User: {sar.user_name || `#${sar.userId}`} ({sar.user_email || "—"})</div>
                            </div>
                            <span className={`badge ${sar.status === "open" ? "badge-error" : "badge-success"}`}>{sar.status}</span>
                          </div>
                          <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{sar.description}</div>
                          {sar.resolutionNotes && <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 10px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>Resolution: {sar.resolutionNotes}</div>}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{new Date(sar.createdAt).toLocaleString()}</span>
                            {sar.status === "open" && (
                              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => resolveSAR(sar.id)}>Mark Resolved</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
