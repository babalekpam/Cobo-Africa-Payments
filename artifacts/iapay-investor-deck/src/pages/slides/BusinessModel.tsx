export default function BusinessModel() {
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
          Business Model
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
          flexDirection: "column",
          gap: "5vh",
        }}
      >
        <p style={{ fontSize: "1.6vw", color: "#555555", lineHeight: 1.5, margin: 0, maxWidth: "62vw" }}>
          Person-to-person payments are free — that drives adoption. Revenue comes from the flows that adoption creates.
        </p>

        <div style={{ display: "flex", gap: "4vw" }}>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "4vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase", marginBottom: "1.5vh" }}>01. FX spread</div>
            <h3 style={{ fontSize: "1.8vw", fontWeight: 600, margin: "0 0 1.5vh 0", color: "#1C2541" }}>Cross-Currency Conversion</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              A thin spread on cross-currency payments at scheme rates — still far below today's 7%+ corridor costs, at continental volume.
            </p>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "4vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase", marginBottom: "1.5vh" }}>02. Merchant and API fees</div>
            <h3 style={{ fontSize: "1.8vw", fontWeight: 600, margin: "0 0 1.5vh 0", color: "#1C2541" }}>Checkout and Acceptance</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Per-transaction fees on merchant QR acceptance and the hosted checkout API — the Stripe model, priced for African businesses.
            </p>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "4vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase", marginBottom: "1.5vh" }}>03. Scheme membership</div>
            <h3 style={{ fontSize: "1.8vw", fontWeight: 600, margin: "0 0 1.5vh 0", color: "#1C2541" }}>Institutional Fees</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Membership and settlement fees from banks, mobile money operators, and fintechs joining the network — recurring, high-margin scheme revenue.
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
        <span>09</span>
      </div>
    </div>
  );
}
