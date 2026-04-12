import { useState } from "react";
import { useLocation } from "wouter";
import api from "../lib/api";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post("/auth/forgot-password", { email }); } catch {}
    setSent(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={`${import.meta.env.BASE_URL}cobo-brand-logo.png`} alt="COBO Africa Payments" style={{ height: 48, borderRadius: 8, margin: "0 auto 16px" }} />
        </div>
        <div className="card-lg">
          {sent ? (
            <>
              <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>📧</div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 10, textAlign: "center" }}>Check your email</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>If that email is registered, a reset link has been sent. Check your inbox (and spam folder).</p>
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Reset your password</h3>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 20 }}>Enter your email and we'll send you a reset link.</p>
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Email address</label>
                  <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>{loading ? <span className="spinner" /> : "Send Reset Link"}</button>
              </form>
            </>
          )}
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text-dim)" }}>
            <a href="#" onClick={e => { e.preventDefault(); setLocation("/login"); }} style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 600 }}>Back to login</a>
          </div>
        </div>
      </div>
    </div>
  );
}
