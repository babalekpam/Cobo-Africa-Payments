import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }} className="fade-in">
        <div style={{ fontSize: 64, marginBottom: 16 }}>🌍</div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32, fontWeight: 700, marginBottom: 8 }}>404</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 16, marginBottom: 24 }}>Page not found</p>
        <button className="btn btn-primary" onClick={() => setLocation("/dashboard")}>Go to Dashboard</button>
      </div>
    </div>
  );
}
