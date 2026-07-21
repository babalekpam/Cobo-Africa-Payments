import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { useLocation } from "wouter";

function TermsContent() {
  const [, setLocation] = useLocation();
  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">Terms of Service</h1>
        <p className="page-subtitle">Last updated: January 2024</p>
      </div>
      <div className="card-lg" style={{ maxWidth: 720, lineHeight: 1.8, fontSize: 14, color: "var(--text)" }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>1. Acceptance of Terms</h3>
        <p style={{ marginBottom: 20 }}>By accessing or using the IAPAY (Inter-Africa Pay) platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>2. Eligibility</h3>
        <p style={{ marginBottom: 20 }}>You must be at least 18 years old and legally able to enter into contracts. You must provide accurate and complete registration information.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>3. Account & KYC</h3>
        <p style={{ marginBottom: 20 }}>You are responsible for maintaining the confidentiality of your account credentials. We may require identity verification (KYC) before allowing certain transactions. Unverified accounts are limited to $100 per transaction.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>4. Transactions</h3>
        <p style={{ marginBottom: 20 }}>IAPAY facilitates cross-border payments across Africa. All transactions are subject to applicable fees, daily limits based on your KYC level, and regulatory compliance. Transaction fees are displayed before confirmation.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>5. Prohibited Activities</h3>
        <p style={{ marginBottom: 20 }}>You may not use IAPAY for money laundering, terrorist financing, fraud, or any illegal activity. We reserve the right to freeze accounts and report suspicious activity to authorities.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>6. Limitation of Liability</h3>
        <p style={{ marginBottom: 20 }}>IAPAY is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from use of the Service.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>7. Changes to Terms</h3>
        <p style={{ marginBottom: 20 }}>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, margin: "0 0 12px", color: "var(--gold)" }}>8. Contact</h3>
        <p>For questions about these Terms, contact us at <span style={{ color: "var(--gold)", fontWeight: 600 }}>legal@iapay.africa</span></p>
      </div>
      <div style={{ marginTop: 16, fontSize: 13 }}>
        <a href="#" onClick={e => { e.preventDefault(); setLocation("/login"); }} style={{ color: "var(--gold)", textDecoration: "none" }}>Back to login</a>
      </div>
    </div>
  );
}

export default function Terms() {
  const { user } = useAuth();
  if (user) return <Layout><TermsContent /></Layout>;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <TermsContent />
      </div>
    </div>
  );
}
