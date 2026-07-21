export default function TitleSlide() {
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
          height: "35vh",
          backgroundColor: "#1C2541",
          color: "#FFFFFF",
          padding: "6vh 8vw",
          boxSizing: "border-box",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1.2vw", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>
            Inter-Africa Pay
          </div>
          <div style={{ fontSize: "1.2vw", fontWeight: 500, letterSpacing: "0.1em", opacity: 0.8 }}>
            cob-o.com
          </div>
        </div>

        <h1
          style={{
            fontSize: "4.5vw",
            fontWeight: 600,
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          IAPAY
        </h1>

        <div
          style={{
            position: "absolute",
            bottom: "-4vw",
            right: "8vw",
            width: "8vw",
            height: "8vw",
            borderRadius: "50%",
            border: "0.2vw solid #1C2541",
            backgroundColor: "#FFFFFF",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "6.5vw",
              height: "6.5vw",
              borderRadius: "50%",
              border: "0.1vw solid #1C2541",
              opacity: 0.5,
            }}
          />
        </div>
      </div>

      <div
        style={{
          height: "65vh",
          padding: "8vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <p
          style={{
            fontSize: "2vw",
            fontWeight: 400,
            color: "#555555",
            margin: 0,
            maxWidth: "60vw",
            lineHeight: 1.5,
          }}
        >
          The instant payment scheme for Africa. One network for keys, QR, and 24/7 cross-border clearing across the continent.
        </p>

        <div
          style={{
            marginTop: "auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4vh 8vw",
            fontFamily: "'DM Mono', monospace",
            fontSize: "1.2vw",
            maxWidth: "50vw",
            borderTop: "0.1vh solid #E0E0E0",
            paddingTop: "4vh",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <span style={{ color: "#888888", fontSize: "1vw", textTransform: "uppercase" }}>Prepared for:</span>
            <span style={{ fontWeight: 600 }}>Investors</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <span style={{ color: "#888888", fontSize: "1vw", textTransform: "uppercase" }}>Date:</span>
            <span style={{ fontWeight: 600 }}>Q3 2026</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <span style={{ color: "#888888", fontSize: "1vw", textTransform: "uppercase" }}>Classification:</span>
            <span style={{ fontWeight: 600, color: "#1C2541" }}>CONFIDENTIAL</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
            <span style={{ color: "#888888", fontSize: "1vw", textTransform: "uppercase" }}>Reference:</span>
            <span style={{ fontWeight: 600 }}>IAPAY-2026-INV</span>
          </div>
        </div>
      </div>
    </div>
  );
}
