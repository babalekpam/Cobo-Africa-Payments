import { useLocation } from "wouter";

export default function AmlPolicy() {
  const [, setLocation] = useLocation();

  const sections = [
    {
      title: "1. Introduction & Purpose",
      content: `COBO Africa Payments Ltd ("COBO", "we", "our") is committed to preventing money laundering, terrorist financing, and other financial crimes. This Bank Secrecy Act (BSA) and Anti-Money Laundering (AML) Policy establishes the framework, procedures, and controls that COBO implements to comply with all applicable federal and state regulations, including the Bank Secrecy Act, the USA PATRIOT Act, and FinCEN regulations governing Money Services Businesses (MSBs).

This policy applies to all COBO employees, officers, agents, and third-party service providers involved in the processing, transmission, or handling of funds.`
    },
    {
      title: "2. Regulatory Framework",
      content: `COBO operates as a registered Money Services Business (MSB) with the Financial Crimes Enforcement Network (FinCEN). Our compliance program addresses requirements under:

\u2022 Bank Secrecy Act (BSA) — 31 USC 5311 et seq.
\u2022 USA PATRIOT Act — Title III (Anti-Money Laundering)
\u2022 FinCEN MSB Registration — 31 CFR 1022
\u2022 Office of Foreign Assets Control (OFAC) Sanctions Programs
\u2022 State money transmitter licensing requirements
\u2022 International AML standards (FATF Recommendations)

FinCEN Registration Number: [To be added upon issuance]`
    },
    {
      title: "3. BSA/AML Compliance Officer",
      content: `COBO designates a qualified BSA/AML Compliance Officer responsible for:

\u2022 Day-to-day administration of this compliance program
\u2022 Ensuring all employees receive adequate AML training
\u2022 Filing required reports with FinCEN (CTRs, SARs)
\u2022 Responding to law enforcement requests and regulatory examinations
\u2022 Conducting periodic risk assessments
\u2022 Maintaining all required records

The Compliance Officer reports directly to senior management and has full authority to implement and enforce this policy.`
    },
    {
      title: "4. Customer Identification Program (CIP)",
      content: `Before establishing a business relationship or conducting transactions, COBO collects and verifies the identity of each customer through our multi-tiered Know Your Customer (KYC) process:

Tier 0 — Basic Registration: Full name, email address, phone number. Transaction limit: $100/day.

Tier 1 — Identity Verification: Government-issued photo ID (passport, national ID, driver's license), selfie verification, date of birth. Transaction limit: $5,000/day.

Tier 2 — Enhanced Verification: Proof of address (utility bill, bank statement), source of funds declaration, business verification (if applicable). Transaction limit: $50,000/day.

All identity documents are verified, and customer information is screened against OFAC SDN lists, PEP databases, and other relevant watchlists before account activation.`
    },
    {
      title: "5. Customer Due Diligence (CDD)",
      content: `COBO performs risk-based Customer Due Diligence on all customers:

\u2022 Standard Due Diligence: Identity verification, sanctions screening, and transaction monitoring for all customers.

\u2022 Enhanced Due Diligence (EDD): Additional scrutiny applied to high-risk customers, including:
  — Politically Exposed Persons (PEPs) and their associates
  — Customers from high-risk jurisdictions (FATF grey/black list countries)
  — Customers with unusual transaction patterns
  — High-volume or high-value transactors
  — Customers flagged by our monitoring systems

EDD measures include: source of funds/wealth verification, purpose of account, expected transaction activity, ongoing enhanced monitoring, and senior management approval.`
    },
    {
      title: "6. Transaction Monitoring",
      content: `COBO maintains automated and manual transaction monitoring systems designed to detect suspicious activity:

\u2022 Real-time screening of all transactions against OFAC SDN lists
\u2022 Velocity monitoring (daily, weekly, monthly transaction limits)
\u2022 Pattern detection for structuring/smurfing (transactions just below reporting thresholds)
\u2022 Cross-border transaction monitoring with country risk assessment
\u2022 Peer comparison analysis
\u2022 Unusual activity alerts (sudden changes in transaction behavior)

All alerts are reviewed by the compliance team within 24 hours and escalated as appropriate.`
    },
    {
      title: "7. Currency Transaction Reports (CTRs)",
      content: `COBO files Currency Transaction Reports (CTRs) with FinCEN for:

\u2022 Any single transaction exceeding $10,000 (or its foreign currency equivalent)
\u2022 Multiple transactions by or on behalf of the same person totaling more than $10,000 in a single business day (aggregate reporting)

CTRs are filed within 15 calendar days of the transaction date using FinCEN's BSA E-Filing System. COBO does not inform the customer that a CTR has been filed.`
    },
    {
      title: "8. Suspicious Activity Reports (SARs)",
      content: `COBO files Suspicious Activity Reports (SARs) with FinCEN when:

\u2022 A transaction involves $2,000 or more and the MSB knows, suspects, or has reason to suspect the transaction:
  — Involves funds derived from illegal activity
  — Is designed to evade BSA reporting requirements (structuring)
  — Has no business or apparent lawful purpose
  — Involves the use of the MSB to facilitate criminal activity

\u2022 There is evidence of potential terrorist financing
\u2022 Suspicious patterns are identified through our monitoring systems

SARs are filed within 30 calendar days of detecting the suspicious activity. All SAR filings are confidential — COBO does not disclose SAR filings to any person involved in the transaction.`
    },
    {
      title: "9. OFAC Compliance",
      content: `COBO screens all customers, beneficiaries, and counterparties against the Office of Foreign Assets Control (OFAC) Specially Designated Nationals and Blocked Persons List (SDN List), including:

\u2022 Real-time name screening using fuzzy matching algorithms (Jaro-Winkler similarity)
\u2022 Country/jurisdiction screening against embargoed and sanctioned countries
\u2022 Screening at onboarding, at each transaction, and periodically thereafter
\u2022 Immediate blocking of matched transactions pending manual review

Prohibited jurisdictions include but are not limited to: North Korea (DPRK), Iran, Syria, Cuba, and the Crimea, Donetsk, and Luhansk regions. Transactions involving these jurisdictions are blocked automatically.`
    },
    {
      title: "10. Recordkeeping & Retention",
      content: `COBO maintains comprehensive records in compliance with BSA requirements:

\u2022 Customer identification records: Retained for 5 years after the account is closed
\u2022 Transaction records: Retained for 5 years from the date of the transaction
\u2022 CTR and SAR filings: Retained for 5 years from the date of filing
\u2022 Sanctions screening results: Retained for 5 years
\u2022 Correspondence related to compliance: Retained for 5 years
\u2022 Training records: Retained for 5 years after the training date
\u2022 Risk assessments and audit reports: Retained for 5 years

All records are stored securely with appropriate access controls and encryption. COBO does not permanently delete transaction data, customer records, or compliance documents within the 5-year retention period.`
    },
    {
      title: "11. Employee Training",
      content: `All COBO employees receive BSA/AML training:

\u2022 Initial training upon hiring (within 30 days)
\u2022 Annual refresher training
\u2022 Role-specific training for compliance staff
\u2022 Ad hoc training when regulations change

Training covers: recognizing suspicious activity, understanding reporting obligations, OFAC compliance, the consequences of non-compliance, and the employee's role in the compliance program.`
    },
    {
      title: "12. Independent Testing",
      content: `COBO's BSA/AML compliance program is subject to independent testing:

\u2022 Annual independent audit by a qualified third party
\u2022 Testing scope includes: adequacy of policies and procedures, effectiveness of controls, compliance with regulatory requirements, and adequacy of employee training
\u2022 Audit findings are reported to senior management with corrective action plans
\u2022 Follow-up testing to verify remediation of identified deficiencies`
    },
    {
      title: "13. Reporting Obligations",
      content: `Employees who detect suspicious activity are required to report it immediately to the Compliance Officer. Retaliation against any employee who reports suspicious activity in good faith is strictly prohibited.

Failure to comply with BSA/AML requirements may result in:
\u2022 Disciplinary action, up to and including termination
\u2022 Civil money penalties
\u2022 Criminal prosecution

For compliance inquiries, contact: compliance@cobo.africa`
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{
        background: "linear-gradient(135deg, #0F2B4C 0%, #143A5C 50%, #0C2340 100%)",
        padding: "40px 0 36px", color: "#fff", position: "sticky", top: 0, zIndex: 50,
        borderBottom: "3px solid var(--gold)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <img src={`${import.meta.env.BASE_URL}cobo-brand-logo.png`} alt="COBO" style={{ height: 40, borderRadius: 6, marginBottom: 12 }} />
            <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, marginBottom: 4 }}>BSA/AML Compliance Policy</h1>
            <p style={{ fontSize: 14, opacity: 0.75 }}>Bank Secrecy Act & Anti-Money Laundering Program</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setLocation("/")} style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>Home</button>
            <button className="btn btn-ghost" onClick={() => setLocation("/login")} style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>Sign In</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ padding: "16px 20px", background: "rgba(201,138,26,0.08)", border: "1px solid var(--border-gold)", borderRadius: 10, marginBottom: 32, fontSize: 13, color: "var(--text-dim)" }}>
          <strong style={{ color: "var(--gold)" }}>Effective Date:</strong> This policy is effective as of the date of COBO's MSB registration and is reviewed and updated annually, or as needed to reflect changes in regulations.
          <br /><strong style={{ color: "var(--gold)" }}>Last Updated:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}
        </div>

        <nav style={{ marginBottom: 32 }}>
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Table of Contents</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sections.map((s, i) => (
              <a key={i} href={`#section-${i}`} style={{ fontSize: 13, color: "var(--gold)", textDecoration: "none" }}>{s.title}</a>
            ))}
          </div>
        </nav>

        {sections.map((section, i) => (
          <div key={i} id={`section-${i}`} style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20, marginBottom: 12, color: "var(--sidebar-dark)", paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>{section.title}</h2>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: "var(--text)", whiteSpace: "pre-wrap" }}>{section.content}</div>
          </div>
        ))}

        <div style={{ marginTop: 48, padding: "20px 24px", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)" }}>
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Contact</h3>
          <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
            For questions about this policy or to report suspicious activity, contact the COBO Compliance Team:
            <br />Email: compliance@cobo.africa
            <br />COBO Africa Payments Ltd
          </p>
        </div>
      </main>

      <footer style={{ background: "#0C2340", padding: "24px 0", textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "center", gap: 24 }}>
          <span onClick={() => setLocation("/terms")} style={{ cursor: "pointer" }}>Terms of Service</span>
          <span onClick={() => setLocation("/privacy")} style={{ cursor: "pointer" }}>Privacy Policy</span>
          <span onClick={() => setLocation("/aml-policy")} style={{ cursor: "pointer", color: "var(--gold)" }}>BSA/AML Policy</span>
        </div>
        <div style={{ marginTop: 12 }}>&copy; {new Date().getFullYear()} COBO Africa Payments Ltd. All rights reserved.</div>
      </footer>
    </div>
  );
}
