export default function TheProblem() {
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
          The Problem
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
        <p style={{ fontSize: "1.7vw", color: "#555555", lineHeight: 1.5, margin: 0, maxWidth: "62vw" }}>
          Moving money between African countries is slower and more expensive than almost anywhere else in the world.
        </p>

        <div style={{ display: "flex", gap: "4vw" }}>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "4vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#555555", fontSize: "1.1vw", marginBottom: "1vh", textTransform: "uppercase" }}>Remittance fees</div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "1vh" }}>7%+</div>
            <div style={{ fontSize: "1.3vw", color: "#555555", lineHeight: 1.5 }}>
              Average cost of sending money to Sub-Saharan Africa — the most expensive remittance corridor globally, more than double the UN target of 3%.
            </div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "4vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#555555", fontSize: "1.1vw", marginBottom: "1vh", textTransform: "uppercase" }}>Annual FX losses</div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "1vh" }}>~$5B</div>
            <div style={{ fontSize: "1.3vw", color: "#555555", lineHeight: 1.5 }}>
              Lost each year converting African currencies through third currencies like the US dollar instead of trading directly.
            </div>
          </div>
          <div style={{ flex: 1, backgroundColor: "#F5F7FA", padding: "4vh 2.5vw", borderRadius: "0.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", color: "#555555", fontSize: "1.1vw", marginBottom: "1vh", textTransform: "uppercase" }}>Correspondent rerouting</div>
            <div style={{ fontSize: "3.5vw", fontWeight: 700, color: "#1C2541", marginBottom: "1vh" }}>48 hrs</div>
            <div style={{ fontSize: "1.3vw", color: "#555555", lineHeight: 1.5 }}>
              A cross-border payment routed through overseas correspondent banks can take two days and cost up to $200 in intermediary fees.
            </div>
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
        <span>02</span>
      </div>
    </div>
  );
}
