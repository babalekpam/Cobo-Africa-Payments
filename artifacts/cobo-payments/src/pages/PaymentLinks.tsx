import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import api from "../lib/api";

export default function PaymentLinks() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", amount: "", currency: "USD" });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/payment-links").then(({ data }) => setLinks(data.links || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/payment-links", { ...form, amount: Number(form.amount) });
      setShowCreate(false);
      setForm({ title: "", description: "", amount: "", currency: "USD" });
      load();
    } catch (err: any) { alert(err.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div><h1 className="page-title">Payment Links</h1><p className="page-subtitle">Create and share payment pages</p></div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create Link</button>
        </div>

        <div className="card">
          {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : links.length === 0 ? (
            <div className="empty"><div className="empty-icon">🔗</div><div className="empty-title">No payment links</div><div className="empty-desc">Create your first payment link to receive payments</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Title</th><th>Amount</th><th>Status</th><th>Views</th><th>Slug</th><th>Created</th></tr></thead>
                <tbody>
                  {links.map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.title}</td>
                      <td>{l.currency} {Number(l.amount).toLocaleString()}</td>
                      <td><span className={`badge ${l.status === "active" ? "badge-success" : "badge-dim"}`}>{l.status}</span></td>
                      <td>{l.viewCount || 0}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>/pay/{l.slug}</td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="card-lg fade-in" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Create Payment Link</h3>
              <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Invoice #001" /></div>
              <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Description</label><input className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div className="input-group"><label className="input-label">Amount</label><input className="input" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div className="input-group"><label className="input-label">Currency</label><select className="select" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}><option>USD</option><option>NGN</option><option>GHS</option><option>KES</option><option>XOF</option><option>EUR</option></select></div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={create} disabled={saving || !form.title || !form.amount}>{saving ? <span className="spinner" /> : "Create"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
