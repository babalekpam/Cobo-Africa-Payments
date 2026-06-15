import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "GHS", "KES", "ZAR", "TZS", "UGX", "ETB", "EGP", "RWF",
  "XOF", "XAF", "MAD", "CDF", "AOA", "MZN", "ZMW", "TND", "MWK",
];

export default function Receive() {
  const { user, wallets } = useAuth();
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Default to user's default wallet currency
  useEffect(() => {
    const defaultWallet = wallets.find((w) => w.isDefault) || wallets[0];
    if (defaultWallet) setCurrency(defaultWallet.currency);
  }, [wallets]);

  async function generateQR() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ currency, format: "dataurl" });
      if (amount && parseFloat(amount) > 0) params.set("amount", amount);
      const { data: res } = await api.get(`/qr/receive?${params}`);
      setQrDataUrl(res.dataUrl as string);
      setPaymentUrl(res.paymentUrl as string);
    } catch {
      setQrDataUrl(null);
      setPaymentUrl(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generateQR();
  }, [currency, amount]);

  function copyLink() {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Layout>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1
          style={{ color: "#0F2B4C", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}
        >
          Receive Payment
        </h1>
        <p style={{ color: "#666", marginBottom: "2rem" }}>
          Share your QR code or payment link to receive money.
        </p>

        <div className="card" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
          <div
            style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
          >
            <div style={{ flex: 1, minWidth: 140 }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                }}
              >
                Currency
              </label>
              <select
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ width: "100%" }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  fontSize: "0.875rem",
                }}
              >
                Amount (optional)
              </label>
              <input
                className="input"
                type="number"
                placeholder="Leave blank for any amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: "100%" }}
                min="0"
              />
            </div>
          </div>

          {/* QR Code Display */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "2rem",
              background: "#FAF7F2",
              borderRadius: 16,
              marginBottom: "1.5rem",
            }}
          >
            {loading ? (
              <div className="spinner" style={{ width: 48, height: 48 }} />
            ) : qrDataUrl ? (
              <>
                <img
                  src={qrDataUrl}
                  alt="Payment QR Code"
                  style={{ width: 220, height: 220, borderRadius: 12 }}
                />
                <p
                  style={{
                    marginTop: "1rem",
                    color: "#666",
                    fontSize: "0.875rem",
                    textAlign: "center",
                  }}
                >
                  Scan to pay{" "}
                  {amount
                    ? `${currency} ${parseFloat(amount).toLocaleString()}`
                    : `in ${currency}`}
                </p>
              </>
            ) : (
              <div style={{ color: "#999", padding: "3rem" }}>QR unavailable</div>
            )}
          </div>

          {/* Recipient Info */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#999", marginBottom: "0.25rem" }}>
              Recipient
            </div>
            <div style={{ fontWeight: 600, color: "#0F2B4C" }}>
              {user?.first_name} {user?.last_name}
            </div>
            <div style={{ fontSize: "0.875rem", color: "#666" }}>{user?.email}</div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-primary" onClick={copyLink} style={{ flex: 1 }}>
              {copied ? "Copied!" : "Copy Payment Link"}
            </button>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`cobo-qr-${currency}.png`}
                className="btn"
                style={{
                  flex: 1,
                  textAlign: "center",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Download QR
              </a>
            )}
          </div>
        </div>

        {/* Wallet Balances */}
        {wallets.length > 0 && (
          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontWeight: 600, marginBottom: "1rem", color: "#0F2B4C" }}>
              My Wallets
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {wallets.map((w) => (
                <div
                  key={w.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    background: "#FAF7F2",
                    borderRadius: 8,
                    cursor: "pointer",
                    border:
                      w.currency === currency
                        ? "2px solid #C98A1A"
                        : "2px solid transparent",
                  }}
                  onClick={() => setCurrency(w.currency)}
                >
                  <span style={{ fontWeight: 600, color: "#0F2B4C" }}>{w.currency}</span>
                  <span style={{ color: "#C98A1A", fontWeight: 600 }}>
                    {Number(w.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
