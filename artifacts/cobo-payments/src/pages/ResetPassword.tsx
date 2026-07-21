import { useState } from "react";
import { useLocation } from "wouter";
import api from "../lib/api";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pw !== pw2) { setErr("Passwords do not match"); return; }
    if (pw.length < 8) { setErr("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      setDone(true);
    } catch (e2: any) {
      setErr(e2.response?.data?.message || "Reset failed. Link may have expired.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={`${import.meta.env.BASE_URL}iapay-logo.svg`} alt="IAPAY (Inter-Africa Pay)" style={{ height: 48, borderRadius: 8, margin: "0 auto 16px" }} />
        </div>
        <div className="card-lg">
          {done ? (
            <>
              <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>✅</div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 10, textAlign: "center" }}>Password reset!</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", marginBottom: 16 }}>You can now log in with your new password.</p>
              <button className="btn btn-primary btn-full" onClick={() => setLocation("/login")}>Sign In</button>
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Set new password</h3>
              {err && <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid rgba(245,83,83,0.2)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{err}</div>}
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">New password</label>
                  <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 8 characters" required />
                </div>
                <div className="input-group">
                  <label className="input-label">Confirm password</label>
                  <input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Repeat password" required />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading || !token}>{loading ? <span className="spinner" /> : "Reset Password"}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
