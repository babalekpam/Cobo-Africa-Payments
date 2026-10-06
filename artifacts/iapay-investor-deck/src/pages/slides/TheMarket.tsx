export default function TheMarket() {
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
          The Market
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
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.1vw", textTransform: "uppercase" }}>
            Africa digital payments market
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "1.7vw" }}>
            <span style={{ fontSize: "6.5vw", fontWeight: 700, color: "#1C2541", letterSpacing: "-0.02em" }}>$1T+</span>
            <span style={{ fontSize: "1.6vw", color: "#555555" }}>projected by 2035</span>
          </div>
          <p style={{ fontSize: "1.45vw", color: "#555555", lineHeight: 1.6, margin: 0, maxWidth: "36vw" }}>
            Digital payments across Africa are projected to grow from roughly $329B in 2025 to over $1 trillion within a decade, driven by mobile money adoption and cross-border trade.
          </p>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4vh" }}>
          <div style={{ borderTop: "0.2vh solid #1C2541", paddingTop: "2.5vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>Remittance inflows</div>
            <div style={{ fontSize: "2.4vw", fontWeight: 700, color: "#1C2541" }}>$100B+</div>
            <div style={{ fontSize: "1.3vw", color: "#555555", lineHeight: 1.5 }}>Annual remittances into Africa, still moving over the most expensive rails in the world.</div>
          </div>
          <div style={{ borderTop: "0.2vh solid #1C2541", paddingTop: "2.5vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>Intra-African trade</div>
            <div style={{ fontSize: "2.4vw", fontWeight: 700, color: "#1C2541" }}>18% → 50%</div>
            <div style={{ fontSize: "1.3vw", color: "#555555", lineHeight: 1.5 }}>AfCFTA aims to lift intra-African trade from 18% of total trade toward 50% by 2030 — every new trade flow needs a payment rail.</div>
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
        <span>03</span>
      </div>
    </div>
  );
}
