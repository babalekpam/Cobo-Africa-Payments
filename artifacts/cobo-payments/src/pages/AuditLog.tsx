import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import api from "../lib/api";

const ACTION_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failed: "Failed login attempt",
  password_changed: "Password changed",
  password_reset_requested: "Password reset requested",
  password_reset_completed: "Password reset completed",
  "2fa_enabled": "2FA enabled",
  "2fa_disabled": "2FA disabled",
  "2fa_failed": "Failed 2FA attempt",
  transfer_bank: "Bank transfer",
  transfer_mobile_money: "Mobile money transfer",
  account_created: "Account created",
};

const ACTION_ICONS: Record<string, string> = {
  login_success: "✅",
  login_failed: "❌",
  password_changed: "🔑",
  password_reset_requested: "📧",
  password_reset_completed: "🔑",
  "2fa_enabled": "🔐",
  "2fa_disabled": "🔓",
  "2fa_failed": "⚠️",
  transfer_bank: "🏦",
  transfer_mobile_money: "📱",
  account_created: "🌍",
};

const ACTION_TYPE: Record<string, string> = {
  login_failed: "error",
  "2fa_failed": "error",
  login_success: "success",
  "2fa_enabled": "success",
  account_created: "success",
  password_reset_completed: "success",
};

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/audit-log").then(r => { setLogs(r.data.logs || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const color = (t: string) => ({ success: "var(--green)", error: "var(--red)", warning: "var(--gold)" } as any)[t] || "var(--text-dim)";
  const bg = (t: string) => ({ success: "var(--green-bg)", error: "var(--red-bg)", warning: "rgba(201,138,26,0.08)" } as any)[t] || "var(--surface2)";

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Activity Log</h1>
          <p className="page-subtitle">Recent account activity, logins, and security events</p>
        </div>

        {loading && <div className="empty"><span className="spinner" /></div>}
        {!loading && logs.length === 0 && <div className="empty">No activity recorded yet</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {logs.map((log: any) => {
            const type = ACTION_TYPE[log.action] || "";
            const label = ACTION_LABELS[log.action] || log.action;
            const icon = ACTION_ICONS[log.action] || "•";
            return (
              <div key={log.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: bg(type),
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: type ? color(type) : "var(--text)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                    {new Date(log.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    {log.ip && log.ip !== "unknown" && ` · IP: ${log.ip}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
