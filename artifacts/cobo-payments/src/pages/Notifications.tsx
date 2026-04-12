import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import api from "../lib/api";

export default function Notifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/notifications").then(({ data }) => setNotifs(data.notifications || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    await api.put(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.put("/notifications/read-all");
    load();
  };

  const typeIcon = (t: string) => t === "success" ? "✅" : t === "error" ? "❌" : t === "warning" ? "⚠️" : "ℹ️";

  return (
    <Layout>
      <div className="page fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div><h1 className="page-title">Notifications</h1><p className="page-subtitle">Stay updated on your account activity</p></div>
          {notifs.some(n => !n.isRead) && <button className="btn btn-ghost" onClick={markAllRead}>Mark All Read</button>}
        </div>

        {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : notifs.length === 0 ? (
          <div className="card"><div className="empty"><div className="empty-icon">🔔</div><div className="empty-title">No notifications</div><div className="empty-desc">You're all caught up!</div></div></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifs.map((n: any) => (
              <div key={n.id} className="card" style={{ opacity: n.isRead ? 0.6 : 1, borderLeft: !n.isRead ? "3px solid var(--gold)" : undefined, cursor: !n.isRead ? "pointer" : undefined }} onClick={() => !n.isRead && markRead(n.id)}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 22 }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 14, color: "var(--text-dim)" }}>{n.message}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                  {!n.isRead && <span className="badge badge-warning" style={{ fontSize: 10 }}>New</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
