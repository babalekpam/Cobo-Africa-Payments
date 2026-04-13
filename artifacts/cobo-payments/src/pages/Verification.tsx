import { useState, useEffect, useRef } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const LEVELS = [
  { level: 0, label: "Unverified", limits: "Send up to $100/day", requires: "Basic info" },
  { level: 1, label: "Basic", limits: "Send up to $5,000/day", requires: "ID document + selfie" },
  { level: 2, label: "Full", limits: "Up to $50,000/day", requires: "Address proof + Level 1" },
];

const DOC_TYPES = [
  { value: "passport", label: "Passport", forLevel: 1 },
  { value: "national_id", label: "National ID", forLevel: 1 },
  { value: "drivers_license", label: "Driver's License", forLevel: 1 },
  { value: "selfie", label: "Selfie with ID", forLevel: 1 },
  { value: "utility_bill", label: "Utility Bill (Address Proof)", forLevel: 2 },
  { value: "bank_statement", label: "Bank Statement", forLevel: 2 },
];

export default function Verification() {
  const { user, refreshUser } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ type: "passport", number: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/kyc/documents").then(({ data }) => setDocs(data.documents || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError("File too large. Maximum size is 10MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError("Invalid file type. Please upload JPEG, PNG, WebP, or PDF.");
      return;
    }
    setSelectedFile(file);
    setUploadError("");
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { data } = await api.post("/kyc/upload-url", {
        name: file.name,
        contentType: file.type,
      });

      setUploadProgress(30);

      const uploadRes = await fetch(data.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        console.error("Upload PUT failed:", uploadRes.status);
        return null;
      }

      setUploadProgress(80);
      return data.objectPath;
    } catch (err: any) {
      console.error("Upload failed:", err);
      return null;
    }
  };

  const submit = async () => {
    setUploading(true);
    setUploadError("");
    setUploadProgress(0);
    try {
      let filePath: string | undefined;

      if (selectedFile) {
        setUploadProgress(10);
        filePath = (await uploadFile(selectedFile)) || undefined;
        if (!filePath) {
          setUploadError("File upload failed. You can still submit with document number only.");
        }
      }

      setUploadProgress(90);

      await api.post("/kyc/submit", {
        document_type: form.type,
        document_number: form.number || undefined,
        file_path: filePath,
      });

      setUploadProgress(100);
      const { data } = await api.get("/kyc/documents");
      setDocs(data.documents || []);
      await refreshUser();
      setForm({ type: "passport", number: "" });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err.response?.data?.message || "Submission failed");
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const currentLevel = user?.kyc_level || 0;
  const canSubmit = form.number || selectedFile;

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">KYC Verification</h1>
          <p className="page-subtitle">Verify your identity to unlock higher transaction limits</p>
        </div>

        <div className="grid-3" style={{ marginBottom: 28 }}>
          {LEVELS.map(l => (
            <div key={l.level} className="card" style={{ border: currentLevel >= l.level ? "1px solid var(--border-gold)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "var(--font-heading)" }}>Level {l.level}</span>
                {currentLevel >= l.level ? <span className="badge badge-success">Complete</span> : currentLevel === l.level - 1 ? <span className="badge badge-warning">Next</span> : <span className="badge badge-dim">Locked</span>}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{l.label}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }}>{l.limits}</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Requires: {l.requires}</div>
            </div>
          ))}
        </div>

        <div className="grid-2">
          <div className="card-lg">
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Submit Document</h3>
            {user?.kyc_status === "verified" && currentLevel >= 2 ? (
              <div className="empty"><div className="empty-icon">✅</div><div className="empty-title">Fully Verified</div><div className="empty-desc">You have completed all verification levels</div></div>
            ) : user?.kyc_status === "submitted" ? (
              <div className="empty">
                <div className="empty-icon">⏳</div>
                <div className="empty-title">Under Review</div>
                <div className="empty-desc">Your documents are being reviewed. This usually takes 1-24 hours.</div>
              </div>
            ) : (
              <>
                {uploadError && (
                  <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid rgba(217,54,54,0.15)", borderRadius: 8, color: "#D93636", fontSize: 13, marginBottom: 16 }}>{uploadError}</div>
                )}

                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Document Type</label>
                  <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {DOC_TYPES.filter(d => d.forLevel <= currentLevel + 1).map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Document Number (optional if uploading file)</label>
                  <input className="input" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="Enter document number" />
                </div>

                <div className="input-group" style={{ marginBottom: 20 }}>
                  <label className="input-label">Upload Document</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: "2px dashed var(--border)",
                      borderRadius: 10,
                      padding: selectedFile ? "16px 20px" : "32px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "border-color 0.2s, background 0.2s",
                      background: selectedFile ? "rgba(27,158,90,0.04)" : "var(--surface2)",
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.background = "rgba(201,138,26,0.03)"; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = selectedFile ? "rgba(27,158,90,0.04)" : "var(--surface2)"; }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileSelect} style={{ display: "none" }} />
                    {selectedFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                        <span style={{ fontSize: 24 }}>{selectedFile.type.startsWith("image/") ? "🖼️" : "📄"}</span>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedFile.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{(selectedFile.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          style={{ marginLeft: "auto", background: "rgba(217,54,54,0.1)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#D93636", fontSize: 12, fontWeight: 600 }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Click to upload or drag and drop</div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>JPEG, PNG, WebP, or PDF (max 10MB)</div>
                      </>
                    )}
                  </div>
                </div>

                {uploading && uploadProgress > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--gold)", borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, textAlign: "center" }}>
                      {uploadProgress < 30 ? "Preparing upload..." : uploadProgress < 80 ? "Uploading document..." : uploadProgress < 100 ? "Submitting..." : "Complete!"}
                    </div>
                  </div>
                )}

                <button className="btn btn-primary btn-full" onClick={submit} disabled={uploading || !canSubmit}>
                  {uploading ? <span className="spinner" /> : "Submit for Verification"}
                </button>
              </>
            )}
          </div>

          <div>
            <div className="card-lg" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Submitted Documents</h3>
              {loading ? <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div> : docs.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No documents submitted yet</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {docs.map((d: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--surface2)", borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, textTransform: "capitalize" }}>{(d.documentType || d.docType || "").replace(/_/g, " ")}</div>
                        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                          {d.documentNumber?.startsWith?.("file:") ? "File uploaded" : d.documentNumber || d.docUrl || "—"}
                        </div>
                      </div>
                      <span className={`badge ${d.status === "approved" || d.status === "verified" ? "badge-success" : d.status === "rejected" ? "badge-error" : "badge-warning"}`}>
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ background: "rgba(201,138,26,0.04)", border: "1px solid rgba(201,138,26,0.15)" }}>
              <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--gold)" }}>Verification Tips</h4>
              <ul style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                <li>Ensure documents are clearly readable</li>
                <li>ID photos must show all four corners</li>
                <li>Selfie must show you holding your ID</li>
                <li>Address proof must be dated within 3 months</li>
                <li>Files must be JPEG, PNG, WebP, or PDF</li>
                <li>Maximum file size: 10MB</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
