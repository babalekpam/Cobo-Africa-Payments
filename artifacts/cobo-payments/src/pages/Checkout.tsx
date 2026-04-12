import { useState, useEffect } from "react";
import { useRoute } from "wouter";

interface SessionInfo {
  session_id: string;
  amount: number;
  currency: string;
  description: string | null;
  reference: string | null;
  status: string;
  merchant_name: string;
  customer_email: string | null;
  expires_at: string;
}

export default function Checkout() {
  const [, params] = useRoute("/pay/:sessionId");
  const sessionId = params?.sessionId;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/pay/${sessionId}/info`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSession(data);
        if (data.customer_email) setEmail(data.customer_email);
        if (data.status === "paid") setPaid(true);
      })
      .catch(() => setError("Failed to load checkout session"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handlePay = async () => {
    if (!email) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/pay/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, payment_method: "card" }),
      });
      const data = await res.json();
      if (data.success) {
        setPaid(true);
        if (data.redirect_url) setRedirectUrl(data.redirect_url);
      } else {
        setError(data.error || "Payment failed");
      }
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}><div className="spinner" /></div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>!</div>
          <h2 style={styles.title}>Checkout Unavailable</h2>
          <p style={styles.subtitle}>{error}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (session.status === "expired") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ ...styles.errorIcon, background: "#fef9ec", color: "#C98A1A" }}>⏱</div>
          <h2 style={styles.title}>Session Expired</h2>
          <p style={styles.subtitle}>This checkout session has expired. Please request a new one.</p>
        </div>
      </div>
    );
  }

  if (paid) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.title}>Payment Successful</h2>
          <p style={styles.subtitle}>
            {formatAmount(session.amount, session.currency)} paid to {session.merchant_name}
          </p>
          {session.reference && <p style={{ fontSize: 13, color: "#7A6E58", marginTop: 8 }}>Reference: {session.reference}</p>}
          {redirectUrl && (
            <a href={redirectUrl} style={styles.returnBtn}>Return to merchant</a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <span style={styles.logo}>COBO</span>
          <span style={styles.logoBadge}>Checkout</span>
        </div>

        <div style={styles.merchantRow}>
          <span style={{ fontSize: 13, color: "#7A6E58" }}>Pay to</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#2C2416" }}>{session.merchant_name}</span>
        </div>

        <div style={styles.amountBox}>
          <div style={styles.amount}>{formatAmount(session.amount, session.currency)}</div>
          {session.description && <p style={{ fontSize: 14, color: "#7A6E58", marginTop: 4 }}>{session.description}</p>}
          {session.reference && <p style={{ fontSize: 12, color: "#9A8F75", marginTop: 4 }}>Ref: {session.reference}</p>}
        </div>

        <div style={styles.divider} />

        {error && <div style={styles.errorMsg}>{error}</div>}

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Name on card</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Card number</label>
          <input
            type="text"
            className="input"
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            style={{ fontFamily: "monospace" }}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...styles.fieldGroup, flex: 1 }}>
            <label style={styles.label}>Expiry</label>
            <input type="text" className="input" placeholder="MM/YY" maxLength={5} />
          </div>
          <div style={{ ...styles.fieldGroup, flex: 1 }}>
            <label style={styles.label}>CVC</label>
            <input type="text" className="input" placeholder="123" maxLength={4} style={{ fontFamily: "monospace" }} />
          </div>
        </div>

        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handlePay}
          disabled={paying || !email}
          style={{ marginTop: 8 }}
        >
          {paying ? "Processing..." : `Pay ${formatAmount(session.amount, session.currency)}`}
        </button>

        <div style={styles.footer}>
          <span style={{ fontSize: 11, color: "#9A8F75" }}>Secured by</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#C98A1A" }}>COBO</span>
          <span style={{ fontSize: 11, color: "#9A8F75" }}>Africa Payments</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #FAF7F2 0%, #F0E8D5 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: "36px 32px",
    maxWidth: 420,
    width: "100%",
    boxShadow: "0 8px 40px rgba(44,36,22,0.1)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  logo: {
    fontFamily: "var(--font-heading)",
    fontSize: 22,
    fontWeight: 800,
    color: "#C98A1A",
  },
  logoBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9A8F75",
    background: "#F5F0E8",
    padding: "3px 10px",
    borderRadius: 99,
  },
  merchantRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  amountBox: {
    textAlign: "center" as const,
    padding: "20px 0",
  },
  amount: {
    fontFamily: "var(--font-heading)",
    fontSize: 36,
    fontWeight: 800,
    color: "#2C2416",
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    background: "#F5F0E8",
    margin: "16px 0",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#7A6E58",
    marginBottom: 6,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid #F5F0E8",
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "#edf7f2",
    color: "#1B9E5A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 700,
    margin: "0 auto 16px",
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "#fef2f2",
    color: "#D93636",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 700,
    margin: "0 auto 16px",
  },
  title: {
    fontFamily: "var(--font-heading)",
    fontSize: 22,
    fontWeight: 700,
    color: "#2C2416",
    textAlign: "center" as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#7A6E58",
    textAlign: "center" as const,
    lineHeight: 1.6,
  },
  errorMsg: {
    background: "#fef2f2",
    color: "#D93636",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 14,
  },
  returnBtn: {
    display: "inline-block",
    marginTop: 16,
    padding: "10px 24px",
    background: "#C98A1A",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
  },
};
