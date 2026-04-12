import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "wouter";
import api from "../lib/api";

const COUNTRIES = [
  { code: "NG", name: "Nigeria" }, { code: "GH", name: "Ghana" }, { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" }, { code: "EG", name: "Egypt" }, { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" }, { code: "UG", name: "Uganda" }, { code: "RW", name: "Rwanda" },
  { code: "SN", name: "Senegal" }, { code: "CI", name: "Côte d'Ivoire" }, { code: "TG", name: "Togo" },
  { code: "BJ", name: "Benin" }, { code: "BF", name: "Burkina Faso" }, { code: "NE", name: "Niger" },
  { code: "ML", name: "Mali" }, { code: "GW", name: "Guinea-Bissau" },
  { code: "CM", name: "Cameroon" }, { code: "GA", name: "Gabon" }, { code: "TD", name: "Chad" },
  { code: "CG", name: "Congo" }, { code: "CF", name: "Central African Republic" }, { code: "GQ", name: "Equatorial Guinea" },
  { code: "CD", name: "DR Congo" }, { code: "AO", name: "Angola" }, { code: "MZ", name: "Mozambique" },
  { code: "ZM", name: "Zambia" }, { code: "MW", name: "Malawi" }, { code: "BW", name: "Botswana" },
  { code: "NA", name: "Namibia" }, { code: "LS", name: "Lesotho" }, { code: "SZ", name: "Eswatini" },
  { code: "MA", name: "Morocco" }, { code: "TN", name: "Tunisia" }, { code: "DZ", name: "Algeria" },
  { code: "LY", name: "Libya" }, { code: "SD", name: "Sudan" }, { code: "SS", name: "South Sudan" },
  { code: "SO", name: "Somalia" }, { code: "DJ", name: "Djibouti" }, { code: "ER", name: "Eritrea" },
  { code: "GM", name: "Gambia" }, { code: "SL", name: "Sierra Leone" }, { code: "GN", name: "Guinea" },
  { code: "LR", name: "Liberia" }, { code: "MR", name: "Mauritania" },
  { code: "CV", name: "Cape Verde" }, { code: "ST", name: "São Tomé and Príncipe" },
  { code: "MU", name: "Mauritius" }, { code: "SC", name: "Seychelles" }, { code: "MG", name: "Madagascar" },
  { code: "KM", name: "Comoros" }, { code: "BI", name: "Burundi" },
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }, { code: "FR", name: "France" },
];

const STEPS = [
  { num: 1, label: "Personal Info" },
  { num: 2, label: "Identity Verification" },
  { num: 3, label: "Review & Confirm" },
];

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "", country: "NG", phone: "", business_name: "",
    id_type: "national_id", id_number: "", date_of_birth: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const validateStep1 = () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError("First and last name are required"); return false; }
    if (!form.email.trim() || !form.email.includes("@")) { setError("Valid email is required"); return false; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.id_number.trim()) { setError("ID number is required"); return false; }
    if (form.id_number.trim().length < 4) { setError("Please enter a valid ID number"); return false; }
    if (!form.date_of_birth) { setError("Date of birth is required"); return false; }
    const dob = new Date(form.date_of_birth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) { setError("You must be at least 18 years old"); return false; }
    return true;
  };

  const nextStep = () => {
    setError("");
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await register({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        country: form.country,
        phone: form.phone,
        business_name: form.business_name,
        id_type: form.id_type,
        id_number: form.id_number,
        date_of_birth: form.date_of_birth,
      });
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Registration failed");
    }
    setLoading(false);
  };

  const countryName = COUNTRIES.find(c => c.code === form.country)?.name || form.country;
  const idTypeLabel: Record<string, string> = { national_id: "National ID", passport: "Passport", drivers_license: "Driver's License", voter_id: "Voter's Card", residence_permit: "Residence Permit" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in" style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src={`${import.meta.env.BASE_URL}cobo-brand-logo.png`} alt="COBO Africa Payments" style={{ height: 48, borderRadius: 8, margin: "0 auto 16px" }} />
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>Create Account</h1>
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>Join COBO Africa Payments Platform</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, padding: "0 4px" }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{ flex: 1 }}>
              <div style={{
                height: 4, borderRadius: 99,
                background: step >= s.num ? "var(--gold)" : "var(--surface3)",
                transition: "background 0.3s",
              }} />
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginTop: 8,
                color: step >= s.num ? "var(--text)" : "var(--text-faint)", fontSize: 12, fontWeight: 500,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: step >= s.num ? "var(--gold)" : "var(--surface3)",
                  color: step >= s.num ? "#fff" : "var(--text-faint)",
                }}>{step > s.num ? "✓" : s.num}</span>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="card-lg" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid rgba(217,54,54,0.2)", borderRadius: "var(--radius-sm)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

          {step === 1 && (
            <>
              <div className="grid-2">
                <div className="input-group"><label className="input-label">First Name *</label><input className="input" value={form.first_name} onChange={e => set("first_name", e.target.value)} required /></div>
                <div className="input-group"><label className="input-label">Last Name *</label><input className="input" value={form.last_name} onChange={e => set("last_name", e.target.value)} required /></div>
              </div>
              <div className="input-group"><label className="input-label">Email *</label><input className="input" type="email" value={form.email} onChange={e => set("email", e.target.value)} required /></div>
              <div className="input-group"><label className="input-label">Password *</label><input className="input" type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min 8 characters" required /></div>
              <div className="grid-2">
                <div className="input-group"><label className="input-label">Country *</label><select className="select" value={form.country} onChange={e => set("country", e.target.value)}>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
                <div className="input-group"><label className="input-label">Phone (optional)</label><input className="input" value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
              </div>
              <div className="input-group"><label className="input-label">Business Name (optional)</label><input className="input" value={form.business_name} onChange={e => set("business_name", e.target.value)} /></div>
              <button type="button" className="btn btn-primary btn-lg btn-full" onClick={nextStep}>Continue to Verification</button>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ padding: "14px 16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>🛡️</span>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Identity Verification Required</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
                  To comply with financial regulations and protect your account, we need to verify your identity. Please provide a valid government-issued ID.
                </p>
              </div>

              <div className="input-group">
                <label className="input-label">ID Document Type *</label>
                <select className="select" value={form.id_type} onChange={e => set("id_type", e.target.value)}>
                  <option value="national_id">National ID Card</option>
                  <option value="passport">International Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="voter_id">Voter's Card</option>
                  <option value="residence_permit">Residence Permit</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">ID Number *</label>
                <input className="input" value={form.id_number} onChange={e => set("id_number", e.target.value)} placeholder="Enter your document number" />
              </div>

              <div className="input-group">
                <label className="input-label">Date of Birth *</label>
                <input className="input" type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-lg" style={{ flex: 1 }} onClick={() => { setStep(1); setError(""); }}>Back</button>
                <button type="button" className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={nextStep}>Review Details</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ fontSize: 15, fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Review Your Information</div>

              <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Personal Details</div>
                  <div style={{ fontSize: 14 }}><strong>{form.first_name} {form.last_name}</strong></div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{form.email}</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{countryName}{form.phone ? ` • ${form.phone}` : ""}</div>
                  {form.business_name && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{form.business_name}</div>}
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Identity Document</div>
                  <div style={{ fontSize: 14 }}><strong>{idTypeLabel[form.id_type] || form.id_type}</strong></div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>ID Number: {form.id_number}</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Date of Birth: {new Date(form.date_of_birth).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                </div>
              </div>

              <div style={{ padding: "12px 16px", background: "rgba(201,138,26,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-gold)", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text)" }}>Please verify your details.</strong> Your identity document will be reviewed by our compliance team. You can start using basic features immediately while verification is in progress.
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-lg" style={{ flex: 1 }} onClick={() => { setStep(2); setError(""); }}>Back</button>
                <button type="button" className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading}>
                  {loading ? <span className="spinner" /> : "Create Account"}
                </button>
              </div>
            </>
          )}

          <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-dim)" }}>
            Already have an account? <a href="#" onClick={e => { e.preventDefault(); setLocation("/login"); }} style={{ color: "var(--gold)", fontWeight: 600 }}>Sign In</a>
          </p>
        </div>
      </div>
    </div>
  );
}
