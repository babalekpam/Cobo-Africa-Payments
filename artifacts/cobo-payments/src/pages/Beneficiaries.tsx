import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import api from "../lib/api";

export default function Beneficiaries() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "bank", bank_name: "", account_number: "", phone: "", email: "", country: "NG" });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/beneficiaries").then(({ data }) => setList(data.beneficiaries || [])).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async () => {
    setSaving(true);
    try {
      await api.post("/beneficiaries", form);
      setShowAdd(false);
      setForm({ name: "", type: "bank", bank_name: "", account_number: "", phone: "", email: "", country: "NG" });
      load();
    } catch (err: any) { alert(err.response?.data?.message || "Failed"); }
    setSaving(false);
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this beneficiary?")) return;
    await api.delete(`/beneficiaries/${id}`);
    load();
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div><h1 className="page-title">Beneficiaries</h1><p className="page-subtitle">Saved recipients for quick transfers</p></div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Beneficiary</button>
        </div>

        {loading ? <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div> : list.length === 0 ? (
          <div className="card"><div className="empty"><div className="empty-icon">👥</div><div className="empty-title">No beneficiaries</div><div className="empty-desc">Add beneficiaries for faster transfers</div></div></div>
        ) : (
          <div className="grid-3">
            {list.map((b: any) => (
              <div key={b.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontSize: 28 }}>{b.type === "bank" ? "🏦" : b.type === "mobile" ? "📱" : "👤"}</div>
                  <span className="badge badge-dim">{b.type}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{b.name}</div>
                {b.bankName && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{b.bankName} — {b.accountNumber}</div>}
                {b.phone && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{b.phone}</div>}
                {b.email && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{b.email}</div>}
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(b.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <div className="card-lg fade-in" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Add Beneficiary</h3>
              <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Name</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Type</label>
                <select className="select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="bank">Bank</option><option value="mobile">Mobile Money</option><option value="internal">IAPAY User</option>
                </select>
              </div>
              {form.type === "bank" && <>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Bank Name</label><input className="input" value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
                <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Account Number</label><input className="input" value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} /></div>
              </>}
              {form.type === "mobile" && <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>}
              {form.type === "internal" && <div className="input-group" style={{ marginBottom: 16 }}><label className="input-label">Email</label><input className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={add} disabled={saving || !form.name}>{saving ? <span className="spinner" /> : "Save"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
