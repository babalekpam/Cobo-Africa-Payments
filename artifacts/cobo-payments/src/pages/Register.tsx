import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "wouter";

const COUNTRIES = [
  { code: "NG", name: "Nigeria" }, { code: "GH", name: "Ghana" }, { code: "KE", name: "Kenya" },
  { code: "TG", name: "Togo" }, { code: "SN", name: "Senegal" }, { code: "CI", name: "Côte d'Ivoire" },
  { code: "CM", name: "Cameroon" }, { code: "ZA", name: "South Africa" }, { code: "EG", name: "Egypt" },
  { code: "TZ", name: "Tanzania" }, { code: "UG", name: "Uganda" }, { code: "ET", name: "Ethiopia" },
  { code: "RW", name: "Rwanda" }, { code: "MA", name: "Morocco" }, { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" }, { code: "FR", name: "France" },
];

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", country: "NG", phone: "", business_name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await register(form);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--dark)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={`${import.meta.env.BASE_URL}cobo-logo.png`} alt="COBO Africa" style={{ height: 48, borderRadius: 8, margin: "0 auto 16px" }} />
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>Create Account</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>Join COBO Africa Payments Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="card-lg" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid rgba(245,83,83,0.2)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
          <div className="grid-2">
            <div className="input-group"><label className="input-label">First Name</label><input className="input" value={form.first_name} onChange={e => set("first_name", e.target.value)} required /></div>
            <div className="input-group"><label className="input-label">Last Name</label><input className="input" value={form.last_name} onChange={e => set("last_name", e.target.value)} required /></div>
          </div>
          <div className="input-group"><label className="input-label">Email</label><input className="input" type="email" value={form.email} onChange={e => set("email", e.target.value)} required /></div>
          <div className="input-group"><label className="input-label">Password</label><input className="input" type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min 8 characters" required /></div>
          <div className="grid-2">
            <div className="input-group"><label className="input-label">Country</label><select className="select" value={form.country} onChange={e => set("country", e.target.value)}>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
            <div className="input-group"><label className="input-label">Phone (optional)</label><input className="input" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          </div>
          <div className="input-group"><label className="input-label">Business Name (optional)</label><input className="input" value={form.business_name} onChange={e => set("business_name", e.target.value)} /></div>
          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>{loading ? <span className="spinner" /> : "Create Account"}</button>
          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-dim)" }}>
            Already have an account? <a href="#" onClick={e => { e.preventDefault(); setLocation("/login"); }} style={{ color: "var(--gold)", fontWeight: 600 }}>Sign In</a>
          </p>
        </form>
      </div>
    </div>
  );
}
