import { useEffect, useState } from "react";

// Shown on every page of a SANDBOX installation (test money, simulated payouts), so a demo or client
// test can never be mistaken for a live system. Live installations show nothing.
export default function SandboxBanner() {
  const [sandbox, setSandbox] = useState(false);
  useEffect(() => {
    fetch("/api/environment")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSandbox(d?.environment === "sandbox"))
      .catch(() => {});
  }, []);
  if (!sandbox) return null;
  return (
    <div
      role="status"
      style={{
        position: "sticky", top: 0, zIndex: 1000, width: "100%", padding: "6px 12px",
        background: "#b45309", color: "#fff", textAlign: "center", fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
      }}
    >
      SANDBOX — test money only. No real funds are moved; payouts are simulated.
    </div>
  );
}
