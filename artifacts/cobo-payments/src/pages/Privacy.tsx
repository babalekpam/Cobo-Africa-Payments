import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { useLocation } from "wouter";

function PrivacyContent() {
  const [, setLocation] = useLocation();
  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">Privacy Policy</h1>
        <p className="page-subtitle">Last updated: January 2024</p>
      </div>
      <div className="card-lg" style={{ maxWidth: 720, lineHeight: 1.8, fontSize: 14, color: "var(--text)" }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>1. Information We Collect</h3>
        <p style={{ marginBottom: 20 }}>We collect personal information you provide during registration (name, email, phone, country), identity documents for KYC verification, transaction data, and device/usage information.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>2. How We Use Your Information</h3>
        <p style={{ marginBottom: 20 }}>We use your information to: provide and improve our services, process transactions, verify your identity, comply with legal obligations, detect fraud, and communicate important updates.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>3. Data Sharing</h3>
        <p style={{ marginBottom: 20 }}>We do not sell your personal data. We may share information with: payment processing partners (to execute transactions), regulatory authorities (as required by law), and service providers who assist in operating the platform.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>4. Data Security</h3>
        <p style={{ marginBottom: 20 }}>We use industry-standard security measures including encryption, secure servers, and access controls to protect your data. However, no system is completely secure.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>5. Data Retention</h3>
        <p style={{ marginBottom: 20 }}>We retain your data for as long as your account is active and as required by regulatory obligations. Transaction records are kept for a minimum of 5 years per financial regulations.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>6. Your Rights</h3>
        <p style={{ marginBottom: 20 }}>You have the right to: access your personal data, correct inaccuracies, request deletion (subject to legal requirements), and withdraw consent for marketing communications.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>7. Cookies</h3>
        <p style={{ marginBottom: 20 }}>We use essential cookies for authentication and session management. We do not use tracking cookies for advertising purposes.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>8. Contact</h3>
        <p>For privacy inquiries, contact our Data Protection Officer at <span style={{ color: "var(--gold)", fontWeight: 600 }}>privacy@iapay.africa</span></p>
      </div>
      <div style={{ marginTop: 16, fontSize: 13 }}>
        <a href="#" onClick={e => { e.preventDefault(); setLocation("/login"); }} style={{ color: "var(--gold)", textDecoration: "none" }}>Back to login</a>
      </div>
    </div>
  );
}

export default function Privacy() {
  const { user } = useAuth();
  if (user) return <Layout><PrivacyContent /></Layout>;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <PrivacyContent />
      </div>
    </div>
  );
}
