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
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Profile Information</h3>
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
          <div className="card-lg" style={{ maxWidth: 500 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Change Password</h3>
            <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Current Password</label><input className="input" type="password" value={pw.current_password} onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))} /></div>
            <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">New Password</label><input className="input" type="password" value={pw.new_password} onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 8 characters" /></div>
            <div className="input-group" style={{ marginBottom: 20 }}><label className="input-label">Confirm New Password</label><input className="input" type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} /></div>
            <button className="btn btn-primary btn-full" onClick={changePassword} disabled={saving || !pw.current_password || !pw.new_password}>{saving ? <span className="spinner" /> : "Change Password"}</button>
          </div>
        )}
      </div>
    </Layout>
  );
}
