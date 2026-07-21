const base = import.meta.env.BASE_URL;

export default function NetworkTraction() {
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
          Network and Traction
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
          flexDirection: "row",
          gap: "5vw",
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4vh" }}>
          <div style={{ display: "flex", gap: "3vw" }}>
            <div style={{ borderTop: "0.2vh solid #1C2541", paddingTop: "2vh", flex: 1 }}>
              <div style={{ fontSize: "3.2vw", fontWeight: 700, color: "#1C2541" }}>15</div>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1vw", textTransform: "uppercase", marginTop: "0.5vh" }}>Member institutions</div>
            </div>
            <div style={{ borderTop: "0.2vh solid #1C2541", paddingTop: "2vh", flex: 1 }}>
              <div style={{ fontSize: "3.2vw", fontWeight: 700, color: "#1C2541" }}>12</div>
              <div style={{ fontFamily: "'DM Mono', monospace", color: "#888888", fontSize: "1vw", textTransform: "uppercase", marginTop: "0.5vh" }}>Countries covered</div>
            </div>
          </div>
          <p style={{ fontSize: "1.45vw", color: "#555555", lineHeight: 1.6, margin: 0 }}>
            Banks, mobile money operators, and fintechs across Kenya, Nigeria, Ghana, Uganda, Côte d'Ivoire, South Africa, Ethiopia, Senegal, Tanzania, Rwanda, Morocco, and Egypt are connected to the scheme today.
          </p>
          <p style={{ fontSize: "1.45vw", color: "#555555", lineHeight: 1.6, margin: 0 }}>
            The platform is live in production at cob-o.com with the full scheme stack: directory, switch, QR, settlement, and disputes.
          </p>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={`${base}africa-map.png`}
            crossOrigin="anonymous"
            alt="Map of Africa showing IAPAY network coverage"
            style={{ maxHeight: "62vh", maxWidth: "36vw", objectFit: "contain" }}
          />
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
        <span>07</span>
      </div>
    </div>
  );
}
