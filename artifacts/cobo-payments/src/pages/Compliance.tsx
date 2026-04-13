import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

type Tab = "overview" | "kyc" | "screening" | "sar" | "ctr" | "edd";

export default function Compliance() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [kycQueue, setKycQueue] = useState<any[]>([]);
  const [screenings, setScreenings] = useState<any[]>([]);
  const [sars, setSars] = useState<any[]>([]);
  const [ctrs, setCtrs] = useState<any[]>([]);
  const [edds, setEdds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenForm, setScreenForm] = useState({ name: "", country: "" });
  const [screenResult, setScreenResult] = useState<any>(null);
  const [screening, setScreening] = useState(false);
  const [sarForm, setSarForm] = useState({ user_id: "", report_type: "unusual_activity", description: "", risk_level: "medium" });
  const [sarFiling, setSarFiling] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [ctrFilter, setCtrFilter] = useState("pending");
  const [eddForm, setEddForm] = useState({ user_id: "", trigger_reason: "", risk_level: "high", source_of_funds: "", expected_volume: "", business_purpose: "", pep_status: "no" });
  const [eddFiling, setEddFiling] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/compliance/stats").then(({ data }) => setStats(data.stats)).catch(() => {}),
      api.get("/compliance/kyc-queue").then(({ data }) => setKycQueue(data.queue || [])).catch(() => {}),
      api.get("/compliance/screening-log").then(({ data }) => setScreenings(data.screenings || [])).catch(() => {}),
      api.get("/compliance/sar").then(({ data }) => setSars(data.reports || [])).catch(() => {}),
      api.get(`/compliance/ctr?status=${ctrFilter}`).then(({ data }) => setCtrs(data.reports || [])).catch(() => {}),
      api.get("/compliance/edd").then(({ data }) => setEdds(data.reviews || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [ctrFilter]);

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
    try { await api.put(`/compliance/sar/${id}/resolve`, { resolution_notes: notes }); load(); } catch {}
  };

  const fileCTR = async (id: number) => {
    const notes = prompt("Filing notes (e.g. FinCEN BSA ID):");
    try { await api.post(`/compliance/ctr/${id}/file`, { notes: notes || "Filed with FinCEN" }); load(); } catch {}
  };

  const fileEDD = async () => {
    setEddFiling(true);
    try {
      await api.post("/compliance/edd", eddForm);
      setEddForm({ user_id: "", trigger_reason: "", risk_level: "high", source_of_funds: "", expected_volume: "", business_purpose: "", pep_status: "no" });
      load();
    } catch (err: any) { alert(err.response?.data?.message || "Failed"); }
    setEddFiling(false);
  };

  const completeEDD = async (id: number) => {
    const notes = prompt("Review notes:");
    if (!notes) return;
    try { await api.put(`/compliance/edd/${id}/complete`, { review_notes: notes, status: "completed" }); load(); } catch {}
  };

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: "📊" },
    { key: "kyc" as const, label: "KYC Review", icon: "🛡️" },
    { key: "screening" as const, label: "OFAC/SDN", icon: "🔍" },
    { key: "sar" as const, label: "SARs", icon: "🚨" },
    { key: "ctr" as const, label: "CTRs", icon: "📋" },
    { key: "edd" as const, label: "EDD", icon: "🔎" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Compliance Center</h1>
          <p className="page-subtitle">BSA/AML compliance — KYC, OFAC screening, SARs, CTRs, and Enhanced Due Diligence</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t.key)} style={{ position: "relative" }}>
              {t.icon} {t.label}
              {t.key === "ctr" && stats?.ctr?.pending > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#D93636", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{stats.ctr.pending}</span>
              )}
              {t.key === "edd" && stats?.edd?.pending > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#C98A1A", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{stats.edd.pending}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : (
          <>
            {tab === "overview" && stats && (
              <>
                <div className="grid-3" style={{ marginBottom: 20 }}>
                  <div className="stat-card"><div className="stat-card-icon">🛡️</div><div className="stat-card-label">KYC Pending</div><div className="stat-card-value">{stats.kyc.pending_docs}</div></div>
                  <div className="stat-card"><div className="stat-card-icon">✅</div><div className="stat-card-label">Verified Users</div><div className="stat-card-value">{stats.kyc.verified_users} / {stats.kyc.total_users}</div></div>
                  <div className="stat-card"><div className="stat-card-icon">🔍</div><div className="stat-card-label">Screenings (30d)</div><div className="stat-card-value">{stats.screenings.recent_30d}</div></div>
                </div>
                <div className="grid-4" style={{ marginBottom: 28 }}>
                  <div className="stat-card"><div className="stat-card-icon">🚨</div><div className="stat-card-label">Open SARs</div><div className="stat-card-value" style={{ color: stats.sar.open > 0 ? "#dc3545" : "inherit" }}>{stats.sar.open}</div></div>
                  <div className="stat-card"><div className="stat-card-icon">⚠️</div><div className="stat-card-label">Flagged Screenings</div><div className="stat-card-value" style={{ color: stats.screenings.flagged > 0 ? "#dc3545" : "inherit" }}>{stats.screenings.flagged}</div></div>
                  <div className="stat-card"><div className="stat-card-icon">📋</div><div className="stat-card-label">Pending CTRs</div><div className="stat-card-value" style={{ color: stats.ctr?.pending > 0 ? "#C98A1A" : "inherit" }}>{stats.ctr?.pending || 0}</div><div className="stat-card-sub">of {stats.ctr?.total || 0} total</div></div>
                  <div className="stat-card"><div className="stat-card-icon">🔎</div><div className="stat-card-label">Pending EDD</div><div className="stat-card-value" style={{ color: stats.edd?.pending > 0 ? "#C98A1A" : "inherit" }}>{stats.edd?.pending || 0}</div><div className="stat-card-sub">of {stats.edd?.total || 0} total</div></div>
                </div>
                <div className="grid-2">
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>KYC Level Distribution</h3>
                    {(stats.kyc.by_level || []).map((l: any) => (
                      <div key={l.level} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 13 }}>Level {l.level} {l.level === "0" ? "(Unverified)" : l.level === "1" ? "(Basic)" : "(Full)"}</span>
                        <span style={{ fontWeight: 700 }}>{l.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Compliance Summary</h3>
                    {[
                      { label: "Total Screenings", value: stats.screenings.total },
                      { label: "Total SARs Filed", value: stats.sar.total },
                      { label: "Total CTRs Generated", value: stats.ctr?.total || 0 },
                      { label: "Total EDD Reviews", value: stats.edd?.total || 0 },
                      { label: "Clear Rate", value: `${stats.screenings.total > 0 ? Math.round(((stats.screenings.total - stats.screenings.flagged) / stats.screenings.total) * 100) : 100}%` },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                        <span style={{ color: "var(--text-dim)" }}>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "kyc" && (
              <div className="card-lg">
                <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Pending KYC Documents ({kycQueue.length})</h3>
                {kycQueue.length === 0 ? (
                  <div className="empty" style={{ padding: 30 }}><div className="empty-icon">✅</div><div className="empty-title">All Clear</div><div className="empty-desc">No pending KYC documents</div></div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {kycQueue.map((doc: any) => (
                      <div key={doc.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{doc.user_name}</div>
                            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{doc.user_email} {doc.user_country ? `\u2022 ${doc.user_country}` : ""}</div>
                            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>Level: {doc.kyc_level || 0} \u2022 Doc: {(doc.docType || "").replace(/_/g, " ")}</div>
                          </div>
                          <span className="badge badge-warning">Pending</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-primary" style={{ fontSize: 13 }} disabled={reviewingId === doc.id} onClick={() => reviewKYC(doc.id, "approve", Math.min(Number(doc.kyc_level || 0) + 1, 2))}>
                            {reviewingId === doc.id ? <span className="spinner" /> : `\u2713 Approve \u2192 Level ${Math.min(Number(doc.kyc_level || 0) + 1, 2)}`}
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize: 13, color: "#dc3545" }} disabled={reviewingId === doc.id} onClick={() => { const r = prompt("Rejection reason:"); if (r) reviewKYC(doc.id, "reject", undefined, r); }}>
                            \u2717 Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "screening" && (
              <>
                <div className="grid-2" style={{ marginBottom: 24 }}>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>OFAC/SDN Screening</h3>
                    <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Screen names against OFAC SDN list with fuzzy matching (Jaro-Winkler)</p>
                    <div className="input-group" style={{ marginBottom: 12 }}>
                      <label className="input-label">Full Name</label>
                      <input className="input" value={screenForm.name} onChange={e => setScreenForm(p => ({ ...p, name: e.target.value }))} placeholder="Enter name to screen" />
                    </div>
                    <div className="input-group" style={{ marginBottom: 16 }}>
                      <label className="input-label">Country Code (optional)</label>
                      <input className="input" value={screenForm.country} onChange={e => setScreenForm(p => ({ ...p, country: e.target.value }))} placeholder="e.g. NG, US, KP" maxLength={2} />
                    </div>
                    <button className="btn btn-primary btn-full" onClick={runScreen} disabled={screening || !screenForm.name}>
                      {screening ? <span className="spinner" /> : "\uD83D\uDD0D Run OFAC Screening"}
                    </button>
                    {screenResult && !screenResult.error && (
                      <div style={{ marginTop: 16, padding: 16, borderRadius: "var(--radius)", background: screenResult.result === "clear" ? "rgba(40,167,69,0.08)" : screenResult.result === "flagged" ? "rgba(220,53,69,0.08)" : "rgba(201,138,26,0.08)", border: `1px solid ${screenResult.result === "clear" ? "#28a745" : screenResult.result === "flagged" ? "#dc3545" : "#C98A1A"}` }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: screenResult.result === "clear" ? "#28a745" : screenResult.result === "flagged" ? "#dc3545" : "#C98A1A" }}>
                          {screenResult.result === "clear" ? "\u2705 CLEAR" : screenResult.result === "flagged" ? "\uD83D\uDEA8 FLAGGED" : "\u26A0\uFE0F REVIEW REQUIRED"}
                        </div>
                        <div style={{ fontSize: 13 }}>Risk Score: <strong>{screenResult.risk_score}/100</strong></div>
                        <div style={{ fontSize: 13 }}>Source: {screenResult.source}</div>
                        {screenResult.country_risk?.level !== "standard" && <div style={{ fontSize: 13, color: "#dc3545", marginTop: 4 }}>Country risk: {screenResult.country_risk.level} (score: {screenResult.country_risk.score})</div>}
                        {screenResult.matches?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {screenResult.matches.map((m: any, i: number) => (
                              <div key={i} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                                <strong>{m.entry}</strong> \u2014 {m.score}% match ({m.matchType})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="card-lg">
                    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Sanctioned Jurisdictions</h3>
                    <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>Transactions blocked or flagged for these countries</p>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#dc3545", marginBottom: 6 }}>HIGH RISK (Blocked)</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["KP \u2014 North Korea", "IR \u2014 Iran", "SY \u2014 Syria", "CU \u2014 Cuba", "VE \u2014 Venezuela", "MM \u2014 Myanmar", "BY \u2014 Belarus", "RU \u2014 Russia"].map(c => (
                          <span key={c} style={{ padding: "4px 10px", background: "rgba(220,53,69,0.08)", color: "#dc3545", borderRadius: 16, fontSize: 11, fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#C98A1A", marginBottom: 6 }}>MEDIUM RISK (Enhanced screening)</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {["PK \u2014 Pakistan", "NG \u2014 Nigeria", "ML \u2014 Mali", "NE \u2014 Niger", "TD \u2014 Chad", "CF \u2014 C.A.R.", "CD \u2014 DRC", "MZ \u2014 Mozambique", "SD \u2014 Sudan"].map(c => (
                          <span key={c} style={{ padding: "4px 10px", background: "rgba(201,138,26,0.08)", color: "#C98A1A", borderRadius: 16, fontSize: 11, fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-lg">
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Screening Log</h3>
                  {screenings.length === 0 ? (
                    <div className="empty"><div className="empty-desc">No screenings yet</div></div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Name</th><th>Type</th><th>Result</th><th>Risk</th><th>Date</th></tr></thead>
                        <tbody>
                          {screenings.slice(0, 50).map((s: any) => (
                            <tr key={s.id}>
                              <td style={{ fontWeight: 600 }}>{s.screenedName}</td>
                              <td style={{ textTransform: "capitalize", fontSize: 13 }}>{s.screenType}</td>
                              <td><span className={`badge ${s.result === "clear" ? "badge-success" : s.result === "flagged" ? "badge-error" : "badge-warning"}`}>{s.result}</span></td>
                              <td><span style={{ fontWeight: 600, color: s.riskScore >= 80 ? "#dc3545" : s.riskScore >= 40 ? "#C98A1A" : "#28a745" }}>{s.riskScore}/100</span></td>
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
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>File New SAR</h3>
                  <div className="grid-2" style={{ marginBottom: 12 }}>
                    <div className="input-group"><label className="input-label">User ID</label><input className="input" value={sarForm.user_id} onChange={e => setSarForm(p => ({ ...p, user_id: e.target.value }))} placeholder="User ID" type="number" /></div>
                    <div className="input-group"><label className="input-label">Report Type</label>
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
                  <div className="input-group" style={{ marginBottom: 12 }}>
                    <label className="input-label">Risk Level</label>
                    <select className="select" style={{ width: 200 }} value={sarForm.risk_level} onChange={e => setSarForm(p => ({ ...p, risk_level: e.target.value }))}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Description</label>
                    <textarea className="input" style={{ minHeight: 80, resize: "vertical" }} value={sarForm.description} onChange={e => setSarForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the suspicious activity..." />
                  </div>
                  <button className="btn btn-primary" onClick={fileSAR} disabled={sarFiling || !sarForm.user_id || !sarForm.description}>
                    {sarFiling ? <span className="spinner" /> : "\uD83D\uDEA8 File SAR"}
                  </button>
                </div>
                <div className="card-lg">
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>SAR Reports ({sars.length})</h3>
                  {sars.length === 0 ? (
                    <div className="empty"><div className="empty-desc">No SARs filed</div></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sars.map((sar: any) => (
                        <div key={sar.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: `1px solid ${sar.status === "open" ? "rgba(220,53,69,0.3)" : "var(--border)"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <div>
                              <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{sar.reportType.replace(/_/g, " ")}</span>
                              <span className={`badge ${sar.riskLevel === "critical" ? "badge-error" : sar.riskLevel === "high" ? "badge-warning" : "badge-dim"}`} style={{ marginLeft: 8 }}>{sar.riskLevel}</span>
                            </div>
                            <span className={`badge ${sar.status === "open" ? "badge-error" : "badge-success"}`}>{sar.status}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4 }}>User: {sar.user_name || `#${sar.userId}`} ({sar.user_email || "\u2014"})</div>
                          <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>{sar.description}</div>
                          {sar.status === "open" && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => resolveSAR(sar.id)}>Resolve</button>}
                          {sar.resolutionNotes && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontStyle: "italic" }}>Resolution: {sar.resolutionNotes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "ctr" && (
              <>
                <div className="card-lg" style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: 0 }}>Currency Transaction Reports</h3>
                      <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>Auto-generated for transactions over $10,000 (single or aggregate daily). File with FinCEN within 15 days.</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["pending", "filed"].map(s => (
                        <button key={s} className={`btn ${ctrFilter === s ? "btn-primary" : "btn-ghost"}`} onClick={() => setCtrFilter(s)} style={{ fontSize: 12, padding: "6px 14px", textTransform: "capitalize" }}>{s}</button>
                      ))}
                    </div>
                  </div>
                  {ctrs.length === 0 ? (
                    <div className="empty"><div className="empty-icon">\uD83D\uDCCB</div><div className="empty-desc">No {ctrFilter} CTRs</div></div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>ID</th><th>Customer</th><th>Amount</th><th>USD Equiv.</th><th>Type</th><th>Trigger</th><th>Status</th><th>Date</th>{ctrFilter === "pending" && <th>Action</th>}</tr>
                        </thead>
                        <tbody>
                          {ctrs.map((c: any) => (
                            <tr key={c.id}>
                              <td style={{ fontFamily: "monospace", fontSize: 12 }}>CTR-{c.id}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{c.customerName || c.user_name || "\u2014"}</div>
                                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{c.customerEmail || c.user_email}</div>
                              </td>
                              <td style={{ fontWeight: 600 }}>{c.currency} {c.amount.toLocaleString()}</td>
                              <td style={{ fontWeight: 700, color: "var(--gold)" }}>${c.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              <td style={{ textTransform: "capitalize", fontSize: 13 }}>{(c.transactionType || "").replace(/_/g, " ")}</td>
                              <td>
                                <span className={`badge ${c.triggerType === "aggregate" ? "badge-warning" : "badge-dim"}`}>{c.triggerType}</span>
                                {c.triggerType === "aggregate" && c.aggregateTotal && <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Daily total: ${c.aggregateTotal.toLocaleString()}</div>}
                              </td>
                              <td><span className={`badge ${c.filingStatus === "filed" ? "badge-success" : "badge-warning"}`}>{c.filingStatus}</span></td>
                              <td style={{ fontSize: 13, color: "var(--text-dim)" }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                              {ctrFilter === "pending" && (
                                <td><button className="btn btn-primary" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => fileCTR(c.id)}>File CTR</button></td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "edd" && (
              <>
                <div className="card-lg" style={{ marginBottom: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Enhanced Due Diligence</h3>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Required for PEPs, high-risk jurisdictions, unusual patterns, and high-volume customers.</p>
                  <div className="grid-2" style={{ marginBottom: 12 }}>
                    <div className="input-group"><label className="input-label">User ID</label><input className="input" value={eddForm.user_id} onChange={e => setEddForm(p => ({ ...p, user_id: e.target.value }))} placeholder="User ID" type="number" /></div>
                    <div className="input-group"><label className="input-label">Trigger Reason</label>
                      <select className="select" value={eddForm.trigger_reason} onChange={e => setEddForm(p => ({ ...p, trigger_reason: e.target.value }))}>
                        <option value="">Select reason...</option>
                        <option value="pep">Politically Exposed Person (PEP)</option>
                        <option value="high_risk_country">High-Risk Country</option>
                        <option value="high_volume">High Transaction Volume</option>
                        <option value="unusual_pattern">Unusual Transaction Pattern</option>
                        <option value="sanctions_near_match">Near Sanctions Match</option>
                        <option value="law_enforcement">Law Enforcement Request</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-2" style={{ marginBottom: 12 }}>
                    <div className="input-group"><label className="input-label">PEP Status</label>
                      <select className="select" value={eddForm.pep_status} onChange={e => setEddForm(p => ({ ...p, pep_status: e.target.value }))}>
                        <option value="no">Not a PEP</option><option value="yes">Confirmed PEP</option><option value="associate">PEP Associate</option><option value="family">PEP Family Member</option>
                      </select>
                    </div>
                    <div className="input-group"><label className="input-label">Risk Level</label>
                      <select className="select" value={eddForm.risk_level} onChange={e => setEddForm(p => ({ ...p, risk_level: e.target.value }))}>
                        <option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-2" style={{ marginBottom: 12 }}>
                    <div className="input-group"><label className="input-label">Source of Funds</label><input className="input" value={eddForm.source_of_funds} onChange={e => setEddForm(p => ({ ...p, source_of_funds: e.target.value }))} placeholder="e.g. Employment, Business revenue" /></div>
                    <div className="input-group"><label className="input-label">Expected Monthly Volume</label><input className="input" value={eddForm.expected_volume} onChange={e => setEddForm(p => ({ ...p, expected_volume: e.target.value }))} placeholder="e.g. $5,000 - $10,000" /></div>
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Business Purpose</label>
                    <input className="input" value={eddForm.business_purpose} onChange={e => setEddForm(p => ({ ...p, business_purpose: e.target.value }))} placeholder="Purpose of account and transactions" />
                  </div>
                  <button className="btn btn-primary" onClick={fileEDD} disabled={eddFiling || !eddForm.user_id || !eddForm.trigger_reason}>
                    {eddFiling ? <span className="spinner" /> : "\uD83D\uDD0E Create EDD Review"}
                  </button>
                </div>
                <div className="card-lg">
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>EDD Reviews ({edds.length})</h3>
                  {edds.length === 0 ? (
                    <div className="empty"><div className="empty-desc">No EDD reviews</div></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {edds.map((e: any) => (
                        <div key={e.id} style={{ padding: 16, background: "var(--surface2)", borderRadius: "var(--radius)", border: `1px solid ${e.status === "pending" ? "rgba(201,138,26,0.3)" : "var(--border)"}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <div>
                              <span style={{ fontWeight: 700 }}>{e.user_name || `User #${e.userId}`}</span>
                              <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 8 }}>{e.user_email} {e.user_country ? `\u2022 ${e.user_country}` : ""}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <span className={`badge ${e.riskLevel === "critical" ? "badge-error" : "badge-warning"}`}>{e.riskLevel}</span>
                              <span className={`badge ${e.status === "pending" ? "badge-warning" : "badge-success"}`}>{e.status}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 8, color: "var(--text-dim)" }}>
                            <span>Trigger: <strong style={{ textTransform: "capitalize", color: "var(--text)" }}>{(e.triggerReason || "").replace(/_/g, " ")}</strong></span>
                            {e.pepStatus !== "no" && <span>PEP: <strong style={{ color: "#dc3545" }}>{e.pepStatus}</strong></span>}
                            {e.sourceOfFunds && <span>Funds: {e.sourceOfFunds}</span>}
                            {e.expectedVolume && <span>Volume: {e.expectedVolume}</span>}
                          </div>
                          {e.businessPurpose && <div style={{ fontSize: 13, marginBottom: 8 }}>Purpose: {e.businessPurpose}</div>}
                          {e.reviewNotes && <div style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>Notes: {e.reviewNotes}</div>}
                          {e.status === "pending" && <button className="btn btn-primary" style={{ fontSize: 12, marginTop: 8 }} onClick={() => completeEDD(e.id)}>Complete Review</button>}
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
