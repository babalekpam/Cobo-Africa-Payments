import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "wouter";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, totpCode || undefined);
      setLocation("/dashboard");
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.requires_2fa) {
        setNeeds2FA(true);
        setError("");
      } else {
        setError(data?.message || "Login failed");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={`${import.meta.env.BASE_URL}cobo-brand-logo.png`} alt="COBO Africa Payments" style={{ height: 48, borderRadius: 8, margin: "0 auto 16px" }} />
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>Welcome Back</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>Sign in to your COBO account</p>
        </div>

        <form onSubmit={handleSubmit} className="card-lg" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {error && <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid rgba(245,83,83,0.2)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          {needs2FA && (
            <div className="input-group">
              <label className="input-label">2FA Code</label>
              <input className="input" type="text" inputMode="numeric" maxLength={6} value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter 6-digit code from your authenticator"
                style={{ letterSpacing: 4, textAlign: "center", fontSize: 18 }}
                autoFocus />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <a href="#" onClick={e => { e.preventDefault(); setLocation("/forgot-password"); }} style={{ color: "var(--gold)", fontSize: 13, textDecoration: "none", fontWeight: 500 }}>Forgot password?</a>
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>

          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-dim)" }}>
            Don't have an account?{" "}
            <a href="#" onClick={e => { e.preventDefault(); setLocation("/register"); }} style={{ color: "var(--gold)", fontWeight: 600 }}>Register</a>
          </p>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--text-dim)" }}>
          <a href="#" onClick={e => { e.preventDefault(); setLocation("/terms"); }} style={{ color: "var(--text-dim)", textDecoration: "none" }}>Terms of Service</a>
          {" · "}
          <a href="#" onClick={e => { e.preventDefault(); setLocation("/privacy"); }} style={{ color: "var(--text-dim)", textDecoration: "none" }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
