export default function TheSolution() {
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
          The Solution
        </h2>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", opacity: 0.8 }}>
          IAPAY-2026-INV
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "7vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "row",
          gap: "6vw",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4.5vh" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>01. IAPAY Keys</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>Pay a Phone Number, Not an IBAN</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Like Brazil's Pix: register a phone, email, or national ID as a payment key. Anyone on the network can pay you instantly — no account numbers, no branch codes.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>02. Instant Switch</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>24/7 Cross-Border Clearing</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Payments clear in under a second, around the clock, with cross-currency FX at scheme rates and sanctions screening built into the switch itself.
            </p>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4.5vh" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>03. IAPAY QR</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>One QR Standard for Africa</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              EMVCo-compatible QR codes — the same standard behind Brazil's BR Code — so any merchant can accept instant payments with a printed code.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>04. USSD Access</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>Works on Feature Phones</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              No smartphone required — the full payment experience runs over USSD, reaching the hundreds of millions of Africans on basic handsets.
            </p>
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
        <span>IAPAY — Intra-African Payments</span>
        <span>04</span>
      </div>
    </div>
  );
}
