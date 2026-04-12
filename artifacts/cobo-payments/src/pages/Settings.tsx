import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<"profile" | "security">("profile");
  const [profile, setProfile] = useState({ first_name: user?.first_name || "", last_name: user?.last_name || "", phone: user?.phone || "", business_name: user?.business_name || "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [twoFaStep, setTwoFaStep] = useState<"idle" | "setup" | "verify" | "done" | "disabling">("idle");
  const [qr, setQr] = useState("");
  const [twoFaSecret, setTwoFaSecret] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  const saveProfile = async () => {
    setSaving(true); setMsg("");
    try {
      await api.put("/auth/profile", profile);
      await refreshUser();
      setMsg("Profile updated!");
    } catch (err: any) { setMsg(err.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (pw.new_password !== pw.confirm) { setMsg("Passwords don't match"); return; }
    setSaving(true); setMsg("");
    try {
      await api.post("/auth/change-password", { current_password: pw.current_password, new_password: pw.new_password });
      setMsg("Password changed!");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (err: any) { setMsg(err.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const start2FA = async () => {
    setTwoFaLoading(true);
    try {
      const r = await api.post("/auth/2fa/setup");
      setQr(r.data.qr_code);
      setTwoFaSecret(r.data.secret);
      setTwoFaStep("setup");
    } catch (e: any) { setMsg(e.response?.data?.message || "2FA setup failed"); }
    setTwoFaLoading(false);
  };

  const verify2FA = async () => {
    if (twoFaCode.length !== 6) { setMsg("Enter 6-digit code"); return; }
    setTwoFaLoading(true);
    try {
      await api.post("/auth/2fa/verify", { totp_code: twoFaCode });
      setMsg("2FA enabled successfully!");
      setTwoFaStep("done");
      await refreshUser();
    } catch (e: any) { setMsg(e.response?.data?.message || "Invalid code"); }
    setTwoFaLoading(false);
  };

  const disable2FA = async () => {
    if (!disablePw) { setMsg("Enter your password"); return; }
    setTwoFaLoading(true);
    try {
      await api.post("/auth/2fa/disable", { password: disablePw });
      setMsg("2FA disabled");
      setTwoFaStep("idle");
      setDisablePw("");
      await refreshUser();
    } catch (e: any) { setMsg(e.response?.data?.message || "Failed"); }
    setTwoFaLoading(false);
  };

  const is2FAEnabled = (user as any)?.two_fa_enabled;

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account preferences</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button className={`btn ${tab === "profile" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setTab("profile"); setMsg(""); }}>👤 Profile</button>
          <button className={`btn ${tab === "security" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setTab("security"); setMsg(""); }}>🔒 Security</button>
        </div>

        {msg && <div style={{ padding: "10px 14px", background: msg.includes("!") ? "var(--green-bg)" : "var(--red-bg)", borderRadius: "var(--radius-sm)", color: msg.includes("!") ? "var(--green)" : "var(--red)", fontSize: 13, marginBottom: 16 }}>{msg}</div>}

        {tab === "profile" && (
          <div className="card-lg" style={{ maxWidth: 500 }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Profile Information</h3>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="input-group"><label className="input-label">First Name</label><input className="input" value={profile.first_name} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} /></div>
              <div className="input-group"><label className="input-label">Last Name</label><input className="input" value={profile.last_name} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} /></div>
            </div>
            <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Email</label><input className="input" value={user?.email || ""} disabled /></div>
            <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Phone</label><input className="input" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="input-group" style={{ marginBottom: 20 }}><label className="input-label">Business Name</label><input className="input" value={profile.business_name} onChange={e => setProfile(p => ({ ...p, business_name: e.target.value }))} /></div>
            <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving}>{saving ? <span className="spinner" /> : "Save Changes"}</button>
          </div>
        )}

        {tab === "security" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 500 }}>
            <div className="card-lg">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Change Password</h3>
              <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Current Password</label><input className="input" type="password" value={pw.current_password} onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))} /></div>
              <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">New Password</label><input className="input" type="password" value={pw.new_password} onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 8 characters" /></div>
              <div className="input-group" style={{ marginBottom: 20 }}><label className="input-label">Confirm New Password</label><input className="input" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} /></div>
              <button className="btn btn-primary btn-full" onClick={changePassword} disabled={saving || !pw.current_password || !pw.new_password}>{saving ? <span className="spinner" /> : "Change Password"}</button>
            </div>

            <div className="card-lg">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Two-Factor Authentication</h3>

              {is2FAEnabled && twoFaStep !== "done" ? (
                <div style={{ background: "var(--green-bg)", border: "1px solid rgba(21,122,64,0.2)", borderRadius: "var(--radius-sm)", padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: "var(--green)" }}>✅ 2FA is enabled</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>Your account is protected with an authenticator app</div>
                    </div>
                  </div>
                  {twoFaStep !== "disabling" ? (
                    <button className="btn btn-danger btn-sm" onClick={() => setTwoFaStep("disabling")}>Disable 2FA</button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Confirm your password to disable 2FA:</div>
                      <input className="input" type="password" placeholder="Your password" value={disablePw} onChange={e => setDisablePw(e.target.value)} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-danger" onClick={disable2FA} disabled={twoFaLoading}>{twoFaLoading ? "..." : "Disable 2FA"}</button>
                        <button className="btn btn-ghost" onClick={() => setTwoFaStep("idle")}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : twoFaStep === "idle" || twoFaStep === "done" ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>Authenticator App</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>Add an extra layer of security</div>
                  </div>
                  <button className="btn btn-primary" onClick={start2FA} disabled={twoFaLoading}>{twoFaLoading ? "..." : "Enable 2FA"}</button>
                </div>
              ) : twoFaStep === "setup" ? (
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 14 }}>Set up authenticator app</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {qr && <img src={qr} alt="QR Code" style={{ width: 140, height: 140, borderRadius: 8, border: "1px solid var(--border)" }} />}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>1. Open <strong>Google Authenticator</strong> or <strong>Authy</strong></div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>2. Tap "+" and scan the QR code</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>3. Or enter this key manually:</div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, background: "var(--surface2)", padding: "8px 10px", borderRadius: 6, wordBreak: "break-all", marginBottom: 14, color: "var(--gold)" }}>{twoFaSecret}</div>
                      <input className="input" type="text" inputMode="numeric" maxLength={6} placeholder="Enter 6-digit code" value={twoFaCode}
                        onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ""))}
                        style={{ letterSpacing: 6, textAlign: "center", fontSize: 20, marginBottom: 10 }} />
                      <button className="btn btn-primary btn-full" onClick={verify2FA} disabled={twoFaLoading || twoFaCode.length !== 6}>
                        {twoFaLoading ? "Verifying..." : "Activate 2FA"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
