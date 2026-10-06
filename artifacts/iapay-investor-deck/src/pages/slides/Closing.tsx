export default function Closing() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundColor: "#1C2541",
        fontFamily: "'Inter', sans-serif",
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          padding: "12vh 8vw",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "8vw",
            height: "8vw",
            borderRadius: "50%",
            border: "0.15vw solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "6vh",
          }}
        >
          <div
            style={{
              width: "5vw",
              height: "5vw",
              borderRadius: "50%",
              backgroundColor: "#FFFFFF",
            }}
          />
        </div>

        <h2 style={{ fontSize: "4vw", fontWeight: 600, margin: "0 0 3vh 0", letterSpacing: "-0.02em" }}>
          One Network for Africa
        </h2>

        <p style={{ fontSize: "1.7vw", color: "rgba(255,255,255,0.7)", maxWidth: "44vw", margin: "0 0 8vh 0", lineHeight: 1.5 }}>
          IAPAY is building the instant payment scheme a continent of 1.4 billion people is waiting for. Join us.
        </p>

        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: "1.45vw",
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.05em",
          }}
        >
          abel@argilette.com&nbsp;&nbsp;|&nbsp;&nbsp;cob-o.com
        </div>
      </div>

      <div
        style={{
          height: "8vh",
          padding: "0 8vw",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "0.1vh solid rgba(255,255,255,0.1)",
          fontFamily: "'DM Mono', monospace",
          fontSize: "1vw",
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
        }}
      >
        <span>IAPAY — Intra-African Payments</span>
        <span>10</span>
      </div>
    </div>
  );
}
