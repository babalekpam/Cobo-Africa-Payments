import { useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";

const CURRENCIES = [
  "NGN","KES","ZAR","GHS","UGX","TZS","ETB","EGP","MAD","XOF",
  "XAF","AOA","MZN","ZMW","BWP","MWK","RWF","BIF","DJF","ERN",
  "GMD","GNF","LRD","LSL","LYD","MGA","MRU","MUR","NAD","SLL",
  "SOS","SSP","STN","SZL","TND","SDG","CDF","CVE","KMF","SCR",
  "DZD","SHP","MNT","ZWL"
];

const FEATURES = [
  { icon: "💳", title: "Multi-Currency Wallets", desc: "Hold and manage 44 African currencies in one place. Instant internal transfers with zero fees." },
  { icon: "⚡", title: "Instant Transfers", desc: "Send money across Africa in seconds. Bank transfers, mobile money, and wallet-to-wallet payments." },
  { icon: "🔄", title: "FX Exchange", desc: "Real-time exchange rates between any African currency pair. Transparent fees, no hidden charges." },
  { icon: "🔗", title: "Payment Links", desc: "Create shareable payment links for invoices, subscriptions, and one-time payments. No code required." },
  { icon: "🏪", title: "Merchant Tools", desc: "Accept payments from customers across Africa. Dashboard analytics, transaction reports, and payouts." },
  { icon: "🔐", title: "Bank-Grade Security", desc: "Two-factor authentication, KYC verification, encrypted data, and full audit trails for every transaction." },
];

const STATS = [
  { value: "44", label: "African Currencies" },
  { value: "54", label: "Countries Covered" },
  { value: "<1s", label: "Transfer Speed" },
  { value: "99.9%", label: "Uptime SLA" },
];

const API_CODE = `const cobo = require('@cobo/checkout');

const session = await cobo.sessions.create({
  currency: 'NGN',
  amount: 25000,
  description: 'Premium Plan',
  success_url: 'https://yourapp.com/success',
  cancel_url: 'https://yourapp.com/cancel',
});

// Redirect customer to session.url`;

export default function Landing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (user) { setLocation("/dashboard"); return; }
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [user]);

  return (
    <div style={{ background: "#FAF7F2", minHeight: "100vh" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(250,247,242,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "none",
        transition: "all 0.3s ease",
        padding: "0 40px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #0F2B4C, #143A5C)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#E8A940", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16,
              boxShadow: "0 2px 8px rgba(15,43,76,0.3)",
            }}>C</div>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: "#0F2B4C", letterSpacing: "-0.03em" }}>
              COBO<span style={{ color: "#C98A1A" }}> Africa</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setLocation("/login")} className="btn btn-ghost" style={{ fontSize: 14, fontWeight: 500 }}>Sign In</button>
            <button onClick={() => setLocation("/register")} className="btn btn-primary" style={{ fontSize: 14 }}>Get Started</button>
          </div>
        </div>
      </nav>

      <section style={{
        paddingTop: 140, paddingBottom: 100,
        background: "linear-gradient(180deg, #FAF7F2 0%, #F5F0E8 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -120, right: -120, width: 500, height: 500,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(201,138,26,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -80, left: -80, width: 400, height: 400,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(15,43,76,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 700 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
              background: "rgba(201,138,26,0.1)", borderRadius: 99, marginBottom: 24,
              fontSize: 13, fontWeight: 600, color: "#C98A1A",
            }}>
              <span>🌍</span> Pan-African Payments Infrastructure
            </div>
            <h1 style={{
              fontFamily: "var(--font-heading)", fontSize: 56, fontWeight: 800,
              lineHeight: 1.1, letterSpacing: "-0.04em", color: "#0F2B4C", marginBottom: 24,
            }}>
              Move money across Africa,{" "}
              <span style={{ background: "linear-gradient(135deg, #C98A1A, #E8A940)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                effortlessly
              </span>
            </h1>
            <p style={{ fontSize: 20, lineHeight: 1.6, color: "#5A5044", maxWidth: 560, marginBottom: 40, fontWeight: 400 }}>
              Send, receive, and exchange across 44 African currencies. Built for businesses, developers, and individuals who need fast, reliable cross-border payments.
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <button onClick={() => setLocation("/register")} className="btn btn-primary btn-lg" style={{ fontSize: 16, padding: "16px 36px" }}>
                Create Free Account →
              </button>
              <button onClick={() => {
                document.getElementById("developer-section")?.scrollIntoView({ behavior: "smooth" });
              }} className="btn btn-ghost btn-lg" style={{ fontSize: 16, padding: "16px 36px" }}>
                View API Docs
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 80 }}>
            {STATS.map(s => (
              <div key={s.label} style={{
                background: "#FFFFFF", borderRadius: 16, padding: "28px 24px",
                border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 36, fontWeight: 800, color: "#0F2B4C", letterSpacing: "-0.03em" }}>{s.value}</div>
                <div style={{ fontSize: 14, color: "#7A6E58", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 40, fontWeight: 800, color: "#0F2B4C", letterSpacing: "-0.03em", marginBottom: 16 }}>
            Everything you need for African payments
          </h2>
          <p style={{ fontSize: 18, color: "#7A6E58", maxWidth: 600, margin: "0 auto" }}>
            From personal transfers to enterprise payment processing — one platform for all of Africa.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: "#FFFFFF", borderRadius: 20, padding: "36px 28px",
              border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              transition: "transform 0.2s, box-shadow 0.2s", cursor: "default",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "#0F2B4C", marginBottom: 10, letterSpacing: "-0.02em" }}>{f.title}</h3>
              <p style={{ fontSize: 15, color: "#7A6E58", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "80px 40px", background: "linear-gradient(180deg, #F5F0E8 0%, #FAF7F2 100%)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 36, fontWeight: 800, color: "#0F2B4C", letterSpacing: "-0.03em", marginBottom: 12 }}>
              44 African currencies, one wallet
            </h2>
            <p style={{ fontSize: 16, color: "#7A6E58" }}>Covering every major and emerging African currency</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
            {CURRENCIES.map(c => (
              <div key={c} style={{
                background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10,
                padding: "10px 18px", fontSize: 13, fontWeight: 600, color: "#0F2B4C",
                fontFamily: "var(--font-heading)", letterSpacing: "0.04em",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              }}>{c}</div>
            ))}
          </div>
        </div>
      </section>

      <section id="developer-section" style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px",
              background: "rgba(15,43,76,0.08)", borderRadius: 99, marginBottom: 20,
              fontSize: 13, fontWeight: 600, color: "#0F2B4C",
            }}>
              {"</>"} Developer API
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 36, fontWeight: 800, color: "#0F2B4C", letterSpacing: "-0.03em", marginBottom: 16 }}>
              Stripe-like checkout, built for Africa
            </h2>
            <p style={{ fontSize: 17, color: "#7A6E58", lineHeight: 1.7, marginBottom: 32 }}>
              Integrate African payments in minutes with our developer-friendly API. Create checkout sessions, handle webhooks, and manage payments programmatically.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {["RESTful API with full documentation", "Webhook notifications for every event", "Sandbox mode for testing", "SDK support for Node.js and Python"].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 8,
                    background: "rgba(27,158,90,0.1)", color: "#1B9E5A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>✓</div>
                  <span style={{ fontSize: 15, color: "#5A5044" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: "#0F2B4C", borderRadius: 20, padding: "32px",
            boxShadow: "0 20px 60px rgba(15,43,76,0.25)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44, background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 6, paddingLeft: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27C93F" }} />
              <span style={{ marginLeft: 12, fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>checkout.js</span>
            </div>
            <pre style={{
              marginTop: 24, fontSize: 13, lineHeight: 1.7, color: "#E8F0F8",
              fontFamily: "'SF Mono', 'Fira Code', monospace", whiteSpace: "pre-wrap",
              overflowX: "auto",
            }}>
              <code>{API_CODE}</code>
            </pre>
          </div>
        </div>
      </section>

      <section style={{ padding: "100px 40px", background: "linear-gradient(180deg, #0F2B4C 0%, #0C2340 100%)", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 42, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", marginBottom: 20 }}>
            Ready to move money across Africa?
          </h2>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", marginBottom: 40, lineHeight: 1.6 }}>
            Join thousands of businesses and individuals using COBO for fast, secure cross-border payments across the continent.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <button onClick={() => setLocation("/register")} style={{
              padding: "16px 40px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #E8A940, #C98A1A)", color: "#FFFFFF",
              fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600,
              boxShadow: "0 4px 20px rgba(201,138,26,0.3)",
              transition: "transform 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "")}
            >
              Get Started Free →
            </button>
            <button onClick={() => setLocation("/login")} style={{
              padding: "16px 40px", borderRadius: 12, cursor: "pointer",
              background: "rgba(255,255,255,0.1)", color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.2)",
              fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 500,
              transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      <footer style={{ padding: "60px 40px 40px", background: "#0A1E33", color: "rgba(255,255,255,0.5)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "linear-gradient(135deg, #143A5C, #1A4A6E)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#E8A940", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14,
                }}>C</div>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, color: "#FFFFFF" }}>
                  COBO Africa
                </span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 280 }}>
                Pan-African payments infrastructure connecting businesses and people across the continent.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "var(--font-heading)" }}>Product</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                <span style={{ cursor: "pointer" }}>Wallets</span>
                <span style={{ cursor: "pointer" }}>Transfers</span>
                <span style={{ cursor: "pointer" }}>FX Exchange</span>
                <span style={{ cursor: "pointer" }}>Payment Links</span>
                <span style={{ cursor: "pointer" }}>Merchant Tools</span>
              </div>
            </div>
            <div>
              <h4 style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "var(--font-heading)" }}>Developers</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                <span style={{ cursor: "pointer" }}>API Reference</span>
                <span style={{ cursor: "pointer" }}>Checkout API</span>
                <span style={{ cursor: "pointer" }}>Webhooks</span>
                <span style={{ cursor: "pointer" }}>SDKs</span>
                <span style={{ cursor: "pointer" }}>Sandbox</span>
              </div>
            </div>
            <div>
              <h4 style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "var(--font-heading)" }}>Company</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                <span style={{ cursor: "pointer" }}>About</span>
                <span style={{ cursor: "pointer" }}>Blog</span>
                <span onClick={() => setLocation("/terms")} style={{ cursor: "pointer" }}>Terms of Service</span>
                <span onClick={() => setLocation("/privacy")} style={{ cursor: "pointer" }}>Privacy Policy</span>
                <span style={{ cursor: "pointer" }}>Contact</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>© 2024 COBO Africa. All rights reserved.</span>
            <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
              <span style={{ cursor: "pointer" }}>Twitter</span>
              <span style={{ cursor: "pointer" }}>LinkedIn</span>
              <span style={{ cursor: "pointer" }}>GitHub</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
