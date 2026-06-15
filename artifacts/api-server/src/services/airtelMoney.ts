const BASE = process.env.AIRTEL_ENV === "production"
  ? "https://openapi.airtel.africa"
  : "https://openapiuat.airtel.africa";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = process.env.AIRTEL_CLIENT_ID;
  const clientSecret = process.env.AIRTEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Airtel Money credentials not configured");

  const res = await fetch(`${BASE}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function initiatePayment(params: {
  phone: string;
  amount: number;
  currency: string;
  country: string;
  reference: string;
  name: string;
}): Promise<{ success: boolean; transactionId?: string; status: string; message: string }> {
  const clientId = process.env.AIRTEL_CLIENT_ID;
  if (!clientId) {
    return { success: false, status: "error", message: "Airtel Money not configured" };
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`${BASE}/merchant/v2/payments/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Country": params.country.toUpperCase(),
        "X-Currency": params.currency,
      },
      body: JSON.stringify({
        reference: params.reference,
        subscriber: {
          country: params.country.toUpperCase(),
          currency: params.currency,
          msisdn: params.phone,
        },
        transaction: {
          amount: params.amount,
          country: params.country.toUpperCase(),
          currency: params.currency,
          id: params.reference,
        },
      }),
    });

    const data = await res.json() as { status?: { code?: string; message?: string; result_code?: string }; data?: { transaction?: { id?: string; status?: string } } };
    const txId = data.data?.transaction?.id;
    const resultCode = data.status?.result_code || data.status?.code;

    if (resultCode === "DP00800001006" || data.status?.message === "SUCCESS") {
      return { success: true, transactionId: txId || params.reference, status: "pending", message: "Payment initiated" };
    }
    return { success: false, status: "error", message: data.status?.message || "Payment initiation failed" };
  } catch (err) {
    console.error("[airtelMoney] initiatePayment error:", err);
    return { success: false, status: "error", message: "Network error contacting Airtel Money" };
  }
}

export async function getTransactionStatus(transactionId: string, country: string, currency: string): Promise<{ success: boolean; status: string; data?: unknown }> {
  const clientId = process.env.AIRTEL_CLIENT_ID;
  if (!clientId) return { success: false, status: "error" };

  try {
    const token = await getAccessToken();
    const res = await fetch(`${BASE}/standard/v1/payments/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Country": country.toUpperCase(),
        "X-Currency": currency,
      },
    });

    const data = await res.json() as { data?: { transaction?: { status?: string } }; status?: { message?: string } };
    const txStatus = data.data?.transaction?.status || "UNKNOWN";
    return { success: true, status: txStatus, data };
  } catch (err) {
    console.error("[airtelMoney] getTransactionStatus error:", err);
    return { success: false, status: "error" };
  }
}
