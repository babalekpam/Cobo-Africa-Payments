import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  mode: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function Developer() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyMode, setNewKeyMode] = useState("test");
  const [createdKey, setCreatedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"keys" | "docs" | "webhooks">("keys");
  const token = localStorage.getItem("iapay_token");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchKeys = async () => {
    const res = await fetch("/api/developer/api-keys", { headers });
    const data = await res.json();
    if (data.success) setKeys(data.api_keys);
  };

  useEffect(() => { fetchKeys(); }, []);

  const createKey = async () => {
    if (!newKeyName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newKeyName, mode: newKeyMode }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedKey(data.api_key.key);
        setNewKeyName("");
        fetchKeys();
      }
    } finally { setLoading(false); }
  };

  const revokeKey = async (id: number) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await fetch(`/api/developer/api-keys/${id}`, { method: "DELETE", headers });
    fetchKeys();
  };

  const activeKeys = keys.filter(k => k.isActive);
  const revokedKeys = keys.filter(k => !k.isActive);

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Developer API</h1>
          <p className="page-subtitle">Integrate IAPAY payments into your applications — like Stripe, built for Africa</p>
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid var(--surface2)" }}>
          {(["keys", "docs", "webhooks"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 20px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? "var(--gold)" : "var(--text-dim)",
                borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
                marginBottom: -2,
                fontFamily: "var(--font-heading)",
              }}
            >
              {t === "keys" ? "API Keys" : t === "docs" ? "API Reference" : "Webhooks"}
            </button>
          ))}
        </div>

        {tab === "keys" && (
          <div>
            <div className="card-lg" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Create API Key</h3>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="input-label">Key Name</label>
                  <input className="input" placeholder="e.g. Production Key" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
                </div>
                <div style={{ minWidth: 120 }}>
                  <label className="input-label">Mode</label>
                  <select className="select" value={newKeyMode} onChange={e => setNewKeyMode(e.target.value)}>
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={createKey} disabled={loading || !newKeyName}>
                  {loading ? "Creating..." : "Create Key"}
                </button>
              </div>
            </div>

            {createdKey && (
              <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--gold)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <strong style={{ color: "var(--gold)", fontSize: 14 }}>New API Key Created — Copy it now!</strong>
                  <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(createdKey); }}>Copy</button>
                </div>
                <div style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 8, fontFamily: "monospace", fontSize: 12, wordBreak: "break-all", color: "var(--text)" }}>
                  {createdKey}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>This key will not be shown again. Store it securely.</p>
              </div>
            )}

            <div className="card">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Active Keys</h3>
              {activeKeys.length === 0 ? (
                <div className="empty">No API keys yet. Create one above to get started.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Key</th><th>Mode</th><th>Last Used</th><th>Created</th><th></th></tr></thead>
                    <tbody>
                      {activeKeys.map(k => (
                        <tr key={k.id}>
                          <td style={{ fontWeight: 600 }}>{k.name}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{k.keyPrefix}</td>
                          <td><span className={`badge ${k.mode === "live" ? "badge-success" : "badge-info"}`}>{k.mode}</span></td>
                          <td style={{ fontSize: 12, color: "var(--text-dim)" }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                          <td style={{ fontSize: 12, color: "var(--text-dim)" }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                          <td><button className="btn btn-danger btn-sm" onClick={() => revokeKey(k.id)}>Revoke</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {revokedKeys.length > 0 && (
              <div className="card" style={{ marginTop: 16, opacity: 0.7 }}>
                <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Revoked Keys</h4>
                {revokedKeys.map(k => (
                  <div key={k.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface2)", fontSize: 13 }}>
                    <span>{k.name}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-dim)" }}>{k.keyPrefix}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "docs" && (
          <div>
            <div className="card-lg" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 8, color: "var(--gold)" }}>Quick Start</h3>
              <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 16 }}>
                Accept payments on your platform in 3 steps: create an API key, create a checkout session, redirect customers to pay.
              </p>
              <CodeBlock title="1. Create a Checkout Session" code={`curl -X POST ${window.location.origin}/api/checkout/sessions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25.00,
    "currency": "USD",
    "description": "Premium Plan",
    "customer_email": "customer@example.com",
    "success_url": "https://yoursite.com/success",
    "cancel_url": "https://yoursite.com/cancel",
    "webhook_url": "https://yoursite.com/webhooks/cobo"
  }'`} />
              <CodeBlock title="Response" code={`{
  "id": "cs_a1b2c3d4e5f6...",
  "object": "checkout.session",
  "amount": 25.00,
  "currency": "USD",
  "status": "pending",
  "checkout_url": "${window.location.origin}/pay/cs_a1b2c3d4e5f6...",
  "expires_at": "2024-01-01T01:00:00.000Z"
}`} />
              <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7, marginTop: 16 }}>
                <strong>2.</strong> Redirect your customer to the <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4 }}>checkout_url</code>. They'll see a hosted payment page branded with your business name.
              </p>
              <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7, marginTop: 8 }}>
                <strong>3.</strong> When payment completes, IAPAY will redirect to your <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4 }}>success_url</code> and send a webhook to your server.
              </p>
            </div>

            <div className="card-lg" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16, color: "var(--gold)" }}>API Reference</h3>
              <EndpointDoc
                method="POST"
                path="/api/checkout/sessions"
                desc="Create a checkout session"
                params={[
                  { name: "amount", type: "number", required: true, desc: "Payment amount (> 0)" },
                  { name: "currency", type: "string", required: false, desc: "Currency code (default: USD)" },
                  { name: "description", type: "string", required: false, desc: "Description shown to customer" },
                  { name: "reference", type: "string", required: false, desc: "Your internal reference ID" },
                  { name: "customer_email", type: "string", required: false, desc: "Pre-fill customer email" },
                  { name: "success_url", type: "string", required: false, desc: "Redirect URL after payment" },
                  { name: "cancel_url", type: "string", required: false, desc: "Redirect URL if cancelled" },
                  { name: "webhook_url", type: "string", required: false, desc: "URL for payment notifications" },
                  { name: "metadata", type: "object", required: false, desc: "Custom key-value data" },
                ]}
              />
              <EndpointDoc method="GET" path="/api/checkout/sessions/:id" desc="Retrieve a checkout session" params={[]} />
              <EndpointDoc method="GET" path="/api/checkout/sessions" desc="List all checkout sessions" params={[]} />
              <div style={{ marginTop: 16, padding: "14px", background: "var(--surface2)", borderRadius: 8 }}>
                <strong style={{ fontSize: 13 }}>Authentication</strong>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>All API requests require: <code>Authorization: Bearer {"<your_api_key>"}</code></p>
              </div>
            </div>

            <div className="card-lg">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16, color: "var(--gold)" }}>Session Statuses</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { status: "pending", desc: "Session created, awaiting payment", badge: "badge-warning" },
                  { status: "paid", desc: "Payment completed successfully", badge: "badge-success" },
                  { status: "expired", desc: "Session expired (30 min timeout)", badge: "badge-error" },
                ].map(s => (
                  <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--surface2)" }}>
                    <span className={`badge ${s.badge}`} style={{ minWidth: 70, textAlign: "center" }}>{s.status}</span>
                    <span style={{ fontSize: 14, color: "var(--text-dim)" }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "webhooks" && (
          <div>
            <div className="card-lg" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 8, color: "var(--gold)" }}>Webhooks</h3>
              <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 16 }}>
                IAPAY sends webhook notifications to your server when payment events occur. Include a <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4 }}>webhook_url</code> when creating a checkout session.
              </p>
              <CodeBlock title="Webhook Payload — checkout.session.paid" code={`{
  "event": "checkout.session.paid",
  "data": {
    "id": "cs_a1b2c3d4e5f6...",
    "amount": 25.00,
    "currency": "USD",
    "reference": "CHK-A1B2C3D4",
    "customer_email": "customer@example.com",
    "paid_at": "2024-01-01T00:30:00.000Z",
    "metadata": { "plan": "premium" }
  }
}`} />
            </div>
            <div className="card-lg">
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Webhook Headers</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Header</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr><td style={{ fontFamily: "monospace", fontSize: 12 }}>X-IAPAY-Event</td><td>Event type (e.g. checkout.session.paid)</td></tr>
                    <tr><td style={{ fontFamily: "monospace", fontSize: 12 }}>X-IAPAY-Signature</td><td>HMAC-SHA256 signature for payload verification</td></tr>
                    <tr><td style={{ fontFamily: "monospace", fontSize: 12 }}>Content-Type</td><td>application/json</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6 }}>{title}</div>
      <div style={{ position: "relative" }}>
        <pre style={{
          padding: "14px 16px",
          background: "#2C2416",
          color: "#F0E8D5",
          borderRadius: 10,
          fontSize: 12,
          fontFamily: "monospace",
          overflow: "auto",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}>{code}</pre>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          style={{
            position: "absolute", top: 8, right: 8,
            padding: "4px 10px", background: "rgba(201,138,26,0.2)", border: "1px solid rgba(201,138,26,0.3)",
            borderRadius: 6, color: "#C98A1A", fontSize: 11, cursor: "pointer",
          }}
        >Copy</button>
      </div>
    </div>
  );
}

function EndpointDoc({ method, path, desc, params }: { method: string; path: string; desc: string; params: { name: string; type: string; required: boolean; desc: string }[] }) {
  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--surface2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span className={`badge ${method === "GET" ? "badge-info" : "badge-success"}`} style={{ fontFamily: "monospace", fontSize: 11 }}>{method}</span>
        <code style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{path}</code>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: params.length > 0 ? 10 : 0 }}>{desc}</p>
      {params.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
            <tbody>
              {params.map(p => (
                <tr key={p.name}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.name}</td>
                  <td style={{ fontSize: 12 }}>{p.type}</td>
                  <td>{p.required ? <span style={{ color: "var(--gold)", fontWeight: 600 }}>Yes</span> : <span style={{ color: "var(--text-dim)" }}>No</span>}</td>
                  <td style={{ fontSize: 13, color: "var(--text-dim)" }}>{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
