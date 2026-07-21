export default function ComplianceBuiltIn() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundColor: "#FFFFFF",
        fontFamily: "'Inter', sans-serif",
        color: "#333333",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "15vh",
          backgroundColor: "#1C2541",
          color: "#FFFFFF",
          padding: "4vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ fontSize: "2.5vw", fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
          Compliance Built In
        </h2>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", opacity: 0.8 }}>
          IAPAY-2026-INV
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "6vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "3.5vh",
        }}
      >
        <p style={{ fontSize: "1.6vw", color: "#555555", lineHeight: 1.5, margin: 0, maxWidth: "62vw" }}>
          Regulation is the moat. IAPAY runs a full FinCEN-style MSB compliance program at the switch — not bolted on afterward.
        </p>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", borderTop: "0.2vh solid #1C2541" }}>
          <div style={{ display: "flex", padding: "2.2vh 0", borderBottom: "0.1vh solid #E0E0E0", fontSize: "1.35vw", alignItems: "baseline" }}>
            <div style={{ flex: 1.3, fontWeight: 600, color: "#1C2541" }}>OFAC / sanctions screening</div>
            <div style={{ flex: 2, color: "#555555" }}>Every transfer screened in real time against the SDN list with fuzzy name matching; high-risk countries blocked at the switch.</div>
          </div>
          <div style={{ display: "flex", padding: "2.2vh 0", borderBottom: "0.1vh solid #E0E0E0", fontSize: "1.35vw", alignItems: "baseline" }}>
            <div style={{ flex: 1.3, fontWeight: 600, color: "#1C2541" }}>CTR / SAR / EDD workflows</div>
            <div style={{ flex: 2, color: "#555555" }}>Currency transaction reports auto-generated at the $10K threshold; suspicious activity and enhanced due diligence workflows for compliance officers.</div>
          </div>
          <div style={{ display: "flex", padding: "2.2vh 0", borderBottom: "0.1vh solid #E0E0E0", fontSize: "1.35vw", alignItems: "baseline" }}>
            <div style={{ flex: 1.3, fontWeight: 600, color: "#1C2541" }}>Tiered KYC limits</div>
            <div style={{ flex: 2, color: "#555555" }}>Three verification levels with daily limits from $100 to $50,000, enforced consistently across every rail — web, API, mobile, and USSD.</div>
          </div>
          <div style={{ display: "flex", padding: "2.2vh 0", borderBottom: "0.1vh solid #E0E0E0", fontSize: "1.35vw", alignItems: "baseline" }}>
            <div style={{ flex: 1.3, fontWeight: 600, color: "#1C2541" }}>Audit and dispute rails</div>
            <div style={{ flex: 2, color: "#555555" }}>Full audit logging, payment returns, and a formal dispute-resolution process modeled on Pix's consumer protection framework.</div>
          </div>
        </div>
      </div>

      <div
        style={{
          height: "8vh",
          padding: "0 8vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "0.1vh solid #E0E0E0",
          fontFamily: "'DM Mono', monospace",
          fontSize: "1vw",
          color: "#888888",
          textTransform: "uppercase",
        }}
      >
        <span>IAPAY — Inter-Africa Pay</span>
        <span>06</span>
      </div>
    </div>
  );
}
