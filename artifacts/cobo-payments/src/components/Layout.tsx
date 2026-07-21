import { Link, useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { LanguageSwitcher, useTranslation } from "../i18n/translations";
import api from "../lib/api";

const NAV_KEYS = [
  { path: "/dashboard", key: "dashboard", icon: "📊" },
  { path: "/wallets", key: "wallets", icon: "💰" },
  { path: "/afrix", key: "afrix", icon: "⚡" },
  { path: "/send", key: "send_money", icon: "💸" },
  { path: "/receive", key: "receive", icon: "📲" },
  { path: "/deposit", key: "deposit", icon: "📥" },
  { path: "/transactions", key: "transactions", icon: "📜" },
  { path: "/exchange", key: "fx_exchange", icon: "💱" },
  { path: "/payment-links", key: "payment_links", icon: "🔗" },
  { path: "/beneficiaries", key: "beneficiaries", icon: "👥" },
  { path: "/verification", key: "verification", icon: "🛡️" },
  { path: "/notifications", key: "notifications", icon: "🔔" },
  { path: "/merchants", key: "merchants", icon: "🏪" },
  { path: "/reports", key: "reports", icon: "📈" },
  { path: "/developer", key: "developer", icon: "⚙️" },
  { path: "/activity-log", key: "activity_log", icon: "📋" },
  { path: "/settings", key: "settings", icon: "🔧" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, wallets, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    api.get("/notifications/unread-count").then(({ data }) => setUnread(data.count || 0)).catch(() => {});
  }, [location]);

  const initials = user ? `${(user.first_name || "")[0] || ""}${(user.last_name || "")[0] || ""}`.toUpperCase() : "?";
  const usdWallet = wallets.find(w => w.currency === "USD");

  const allNav = user?.role === "admin"
    ? [...NAV_KEYS.slice(0, -1), { path: "/admin", key: "admin_panel", icon: "🏛️" }, { path: "/compliance", key: "compliance", icon: "⚖️" }, NAV_KEYS[NAV_KEYS.length - 1]]
    : NAV_KEYS;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />}

      <aside style={{
        width: "var(--sidebar-w)", background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)",
        display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 100,
        transform: mobileOpen ? "translateX(0)" : undefined,
        boxShadow: "2px 0 20px rgba(15,43,76,0.15)",
      }} className="sidebar">
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--sidebar-border)" }}>
          <img src={`${import.meta.env.BASE_URL}cobo-brand-logo.png`} alt="COBO Africa Payments" style={{ width: "100%", maxWidth: 200, borderRadius: 8 }} />
        </div>

        <div style={{ padding: "16px", borderBottom: "1px solid var(--sidebar-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, var(--gold-light), var(--gold-dim))",
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-heading)",
              fontWeight: 700, fontSize: 14, color: "#fff",
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--sidebar-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.first_name} {user?.last_name}
              </div>
              <div style={{ fontSize: 12, color: "var(--sidebar-text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {user?.kyc_status === "verified" && <span className="badge badge-success" style={{ fontSize: 10 }}>✓ {t("verified")}</span>}
            {user?.role === "admin" && <span className="badge badge-warning" style={{ fontSize: 10 }}>Admin</span>}
          </div>
          {usdWallet && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--sidebar-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--sidebar-border)" }}>
              <div style={{ fontSize: 11, color: "var(--sidebar-text-dim)", textTransform: "uppercase", letterSpacing: 0.5 }}>USD {t("balance")}</div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20, color: "var(--gold-light)", marginTop: 2 }}>
                ${usdWallet.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: "8px", overflowY: "auto" }}>
          {allNav.map(item => {
            const active = location === item.path || location.startsWith(item.path + "/");
            const label = t(item.key);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    fontSize: 14, fontWeight: active ? 600 : 400, cursor: "pointer", position: "relative",
                    color: active ? "var(--gold-light)" : "var(--sidebar-text-dim)",
                    background: active ? "rgba(232,169,64,0.12)" : "transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-surface)"; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)"; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text-dim)"; } }}
                >
                  <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{item.icon}</span>
                  <span>{label}</span>
                  {item.key === "notifications" && unread > 0 && (
                    <span style={{
                      marginLeft: "auto", background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 700,
                      padding: "1px 6px", borderRadius: 99, minWidth: 18, textAlign: "center",
                    }}>{unread}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--sidebar-border)" }}>
          <LanguageSwitcher style={{ width: "100%", background: "var(--sidebar-surface)", color: "var(--sidebar-text)", border: "1px solid var(--sidebar-border)", fontSize: 12, padding: "6px 8px" }} />
        </div>

        <div style={{ padding: "8px 12px 12px" }}>
          <button onClick={logout} className="btn" style={{ width: "100%", justifyContent: "flex-start", gap: 10, color: "#F55353", background: "rgba(245,83,83,0.08)", border: "none" }}>
            🚪 {t("logout")}
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, marginLeft: "var(--sidebar-w)", minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)",
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} style={{ display: "none", background: "none", border: "none", color: "var(--text)", fontSize: 22, cursor: "pointer" }}>☰</button>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/notifications">
              <div style={{ position: "relative", cursor: "pointer", padding: 6 }}>
                <span style={{ fontSize: 20 }}>🔔</span>
                {unread > 0 && (
                  <span style={{
                    position: "absolute", top: 0, right: 0, background: "var(--red)", color: "#fff",
                    fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99, minWidth: 16, textAlign: "center",
                  }}>{unread}</span>
                )}
              </div>
            </Link>
            <Link href="/settings">
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--gold-light), var(--gold-dim))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 12, color: "#fff", cursor: "pointer",
              }}>{initials}</div>
            </Link>
          </div>
        </header>
        <main style={{ overflow: "auto", flex: 1 }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); transition: transform 0.25s; }
          .mobile-menu-btn { display: block !important; }
          div[style*="marginLeft: var(--sidebar-w)"] { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
