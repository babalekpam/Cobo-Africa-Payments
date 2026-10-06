export default function WhyNow() {
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
          Why Now
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
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>01. Policy tailwind</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>PAPSS Proves the Demand</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              The Pan-African Payment and Settlement System has signed up 17 countries and 150+ banks — central banks are actively pushing for African-owned payment rails.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>02. Mobile money scale</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>$8B Moves Daily</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              African mobile money processes roughly $8B in transactions every day — but the wallets remain siloed by operator and by country.
            </p>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4.5vh" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>03. Proven playbook</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>Pix Showed What Happens</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              Brazil's Pix went from launch to the country's dominant payment method in under four years. The instant-scheme model works — Africa is the largest market without one.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2vh" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1.05vw", textTransform: "uppercase" }}>04. Trade integration</div>
            <h3 style={{ fontSize: "1.9vw", fontWeight: 600, margin: 0, color: "#1C2541" }}>AfCFTA Needs a Rail</h3>
            <p style={{ fontSize: "1.35vw", lineHeight: 1.6, color: "#555555", margin: 0 }}>
              The African Continental Free Trade Area is dismantling trade barriers across 54 countries — every new cross-border trade flow needs a way to settle.
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
        <span>08</span>
      </div>
    </div>
  );
}
