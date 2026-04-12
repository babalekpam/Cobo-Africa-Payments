import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useLocation } from "wouter";
import api from "../lib/api";

export default function Merchants() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", phone: "", country: "", businessType: "" });

  const loadMerchants = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    api.get(`/merchants?${params}`).then(({ data }) => {
      setMerchants(data.data || data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadMerchants(); }, [search, statusFilter]);

  const createMerchant = async () => {
    if (!form.name || !form.email || !form.country) { setError("Name, email and country are required"); return; }
    setCreating(true); setError("");
    try {
      await api.post("/merchants", form);
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", country: "", businessType: "" });
      loadMerchants();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create merchant");
    }
    setCreating(false);
  };

  const deleteMerchant = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this merchant?")) return;
    try {
      await api.delete(`/merchants/${id}`);
      loadMerchants();
    } catch {}
  };

  const statusBadge = (status: string) => {
    const cls = status === "active" ? "badge-success" : status === "suspended" ? "badge-error" : "badge-warning";
    return <span className={`badge ${cls}`} style={{ textTransform: "capitalize" }}>{status}</span>;
  };

  const stats = {
    total: merchants.length,
    active: merchants.filter(m => m.status === "active").length,
    totalVolume: merchants.reduce((s, m) => s + (m.totalVolume || 0), 0),
    totalTxns: merchants.reduce((s, m) => s + (m.transactionCount || 0), 0),
  };

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Merchants</h1>
            <p className="page-subtitle">Manage registered merchants and their transactions</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ gap: 6 }}>
            + Add Merchant
          </button>
        </div>

        <div className="grid-4" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-icon">🏪</div>
            <div className="stat-card-label">Total Merchants</div>
            <div className="stat-card-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">✅</div>
            <div className="stat-card-label">Active</div>
            <div className="stat-card-value" style={{ color: "var(--green)" }}>{stats.active}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">💰</div>
            <div className="stat-card-label">Total Volume</div>
            <div className="stat-card-value">${stats.totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-label">Total Transactions</div>
            <div className="stat-card-value">{stats.totalTxns}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input className="input" placeholder="Search merchants..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
          <select className="select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}><span className="spinner" /></div>
          ) : merchants.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏪</div>
              <div className="empty-title">No merchants found</div>
              <div className="empty-desc">Add your first merchant to get started</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Merchant</th><th>Email</th><th>Country</th><th>Type</th><th>Status</th><th>Volume</th><th>Txns</th><th></th></tr>
                </thead>
                <tbody>
                  {merchants.map((m: any) => (
                    <tr key={m.id} onClick={() => setLocation(`/merchants/${m.id}`)} style={{ cursor: "pointer" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 8,
                            background: "linear-gradient(135deg, var(--gold-light), var(--gold))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontWeight: 700, fontSize: 14,
                          }}>{m.name.charAt(0)}</div>
                          <span style={{ fontWeight: 600 }}>{m.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{m.email}</td>
                      <td>{m.country}</td>
                      <td style={{ color: "var(--text-dim)", fontSize: 13, textTransform: "capitalize" }}>{m.businessType || "—"}</td>
                      <td>{statusBadge(m.status)}</td>
                      <td style={{ fontWeight: 600 }}>${(m.totalVolume || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td>{m.transactionCount || 0}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={e => deleteMerchant(m.id, e)} title="Delete" style={{ padding: "4px 8px", color: "var(--red)" }}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="card-lg fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: "90%" }}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Add Merchant</h2>
              {error && <div style={{ padding: "10px 14px", background: "var(--red-bg)", border: "1px solid rgba(217,54,54,0.15)", borderRadius: 8, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div className="input-group" style={{ marginBottom: 14 }}>
                <label className="input-label">Business Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Shoprite Nigeria" />
              </div>
              <div className="input-group" style={{ marginBottom: 14 }}>
                <label className="input-label">Email *</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="merchant@example.com" />
              </div>
              <div className="input-group" style={{ marginBottom: 14 }}>
                <label className="input-label">Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+234 800 000 0000" />
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Country *</label>
                  <input className="input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="e.g. Nigeria" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Business Type</label>
                  <select className="select" value={form.businessType} onChange={e => setForm(p => ({ ...p, businessType: e.target.value }))}>
                    <option value="">Select...</option>
                    <option value="retail">Retail</option>
                    <option value="e-commerce">E-Commerce</option>
                    <option value="fintech">Fintech</option>
                    <option value="saas">SaaS</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createMerchant} disabled={creating}>
                  {creating ? <span className="spinner" /> : "Create Merchant"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
