import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const LEVELS = [
  { level: 0, label: "Unverified", limits: "Send up to $100/day", requires: "Basic info" },
  { level: 1, label: "Basic", limits: "Send up to $1,000/day", requires: "ID document + selfie" },
  { level: 2, label: "Full", limits: "Unlimited transactions", requires: "Address proof + Level 1" },
];

export default function Verification() {
  const { user, refreshUser } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ type: "passport", number: "" });

  useEffect(() => {
    api.get("/kyc/documents").then(({ data }) => setDocs(data.documents || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setUploading(true);
    try {
      await api.post("/kyc/submit", { document_type: form.type, document_number: form.number });
      const { data } = await api.get("/kyc/documents");
      setDocs(data.documents || []);
      await refreshUser();
      setForm({ type: "passport", number: "" });
    } catch (err: any) { alert(err.response?.data?.message || "Submission failed"); }
    setUploading(false);
  };

  const currentLevel = user?.kyc_level || 0;

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">KYC Verification</h1>
          <p className="page-subtitle">Verify your identity to unlock higher limits</p>
        </div>

        <div className="grid-3" style={{ marginBottom: 28 }}>
          {LEVELS.map(l => (
            <div key={l.level} className="card" style={{ border: currentLevel >= l.level ? "1px solid var(--border-gold)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "'Syne',sans-serif" }}>Level {l.level}</span>
                {currentLevel >= l.level ? <span className="badge badge-success">✓ Complete</span> : currentLevel === l.level - 1 ? <span className="badge badge-warning">Current</span> : <span className="badge badge-dim">Locked</span>}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{l.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>{l.limits}</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Requires: {l.requires}</div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div className="card-lg">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Submit Document</h3>
            {user?.kyc_status === "verified" && currentLevel >= 2 ? (
              <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Fully Verified</div><div className="empty-desc">You have completed all verification levels</div></div>
            ) : (
              <>
                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Document Type</label>
                  <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="utility_bill">Utility Bill</option>
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 20 }}>
                  <label className="input-label">Document Number</label>
                  <input className="input" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="Enter document number" />
                </div>
                <button className="btn btn-primary btn-full" onClick={submit} disabled={uploading || !form.number}>{uploading ? <span className="spinner" /> : "Submit for Verification"}</button>
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Submitted Documents</h3>
            {loading ? <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div> : docs.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}><div className="empty-desc">No documents submitted yet</div></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {docs.map((d: any) => (
                  <div key={d.id} style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>{(d.documentType || "").replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{d.documentNumber}</div>
                    </div>
                    <span className={`badge ${d.status === "approved" || d.status === "verified" ? "badge-success" : d.status === "rejected" ? "badge-error" : "badge-warning"}`}>{d.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
