export default function ThePlatform() {
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
          The Platform
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
          gap: "5vh",
        }}
      >
        <div style={{ display: "flex", gap: "3vw" }}>
          <div style={{ flex: 1, borderTop: "0.2vh solid #1C2541", paddingTop: "2vh" }}>
            <div style={{ fontSize: "2.6vw", fontWeight: 700, color: "#1C2541" }}>&lt;1s</div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1vw", textTransform: "uppercase", marginTop: "0.5vh" }}>Payment clearing</div>
          </div>
          <div style={{ flex: 1, borderTop: "0.2vh solid #1C2541", paddingTop: "2vh" }}>
            <div style={{ fontSize: "2.6vw", fontWeight: 700, color: "#1C2541" }}>44+</div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1vw", textTransform: "uppercase", marginTop: "0.5vh" }}>Currencies supported</div>
          </div>
          <div style={{ flex: 1, borderTop: "0.2vh solid #1C2541", paddingTop: "2vh" }}>
            <div style={{ fontSize: "2.6vw", fontWeight: 700, color: "#1C2541" }}>99.9%</div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1vw", textTransform: "uppercase", marginTop: "0.5vh" }}>Uptime SLA</div>
          </div>
          <div style={{ flex: 1, borderTop: "0.2vh solid #1C2541", paddingTop: "2vh" }}>
            <div style={{ fontSize: "2.6vw", fontWeight: 700, color: "#1C2541" }}>24/7</div>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1vw", textTransform: "uppercase", marginTop: "0.5vh" }}>Settlement cycles</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "4vw", flex: 1 }}>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "3.5vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#555555", fontSize: "1.1vw", marginBottom: "1.5vh", textTransform: "uppercase" }}>Full-stack wallet platform</div>
            <p style={{ fontSize: "1.4vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Multi-currency wallets, FX exchange, bank and mobile money transfers, payment links, and beneficiary management — a complete consumer and business product live today.
            </p>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "3.5vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#555555", fontSize: "1.1vw", marginBottom: "1.5vh", textTransform: "uppercase" }}>Developer checkout API</div>
            <p style={{ fontSize: "1.4vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Stripe-style hosted checkout with API keys, webhooks with signed payloads and retries, and sandbox mode — so any African business can accept payments online.
            </p>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "3.5vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#555555", fontSize: "1.1vw", marginBottom: "1.5vh", textTransform: "uppercase" }}>Scheme settlement</div>
            <p style={{ fontSize: "1.4vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Multilateral net settlement between member institutions — the same deferred netting model used by card schemes — with automatic settlement cycles.
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
        <span>05</span>
      </div>
    </div>
  );
}
