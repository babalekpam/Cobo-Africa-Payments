const BASE = process.env.MTN_ENVIRONMENT === "production"
  ? "https://proxy.momoapi.mtn.com"
  : "https://sandbox.momodeveloper.mtn.com";

const TARGET_ENV = process.env.MTN_ENVIRONMENT === "production" ? "mtnmomo" : "sandbox";

const tokenCache: Record<string, { token: string; expiry: number }> = {};

async function getToken(product: "collection" | "disbursement"): Promise<string> {
  const cached = tokenCache[product];
  if (cached && Date.now() < cached.expiry) return cached.token;

  const apiUserId = product === "collection"
    ? process.env.MTN_COLLECTION_USER_ID
    : process.env.MTN_DISBURSEMENT_USER_ID;
  const apiKey = product === "collection"
    ? process.env.MTN_COLLECTION_API_KEY
    : process.env.MTN_DISBURSEMENT_API_KEY;
  const subscriptionKey = product === "collection"
    ? process.env.MTN_COLLECTION_SUBSCRIPTION_KEY
    : process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY;

  if (!apiUserId || !apiKey || !subscriptionKey) {
    throw new Error(`MTN MoMo ${product} credentials not configured`);
  }

  const credentials = Buffer.from(`${apiUserId}:${apiKey}`).toString("base64");
  const res = await fetch(`${BASE}/${product}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });

  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache[product] = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function requestToPay(params: {
  amount: number;
  currency: string;
  phone: string;
  reference: string;
  payerMessage: string;
  payeeNote: string;
  callbackUrl?: string;
}): Promise<{ success: boolean; referenceId?: string; status: string; message: string }> {
  const subscriptionKey = process.env.MTN_COLLECTION_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    return { success: false, status: "error", message: "MTN MoMo not configured" };
  }

  try {
    const token = await getToken("collection");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": params.reference,
      "X-Target-Environment": TARGET_ENV,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    };
    if (params.callbackUrl) headers["X-Callback-Url"] = params.callbackUrl;

    const res = await fetch(`${BASE}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: String(params.amount),
        currency: params.currency,
        externalId: params.reference,
        payer: { partyIdType: "MSISDN", partyId: params.phone },
        payerMessage: params.payerMessage,
        payeeNote: params.payeeNote,
      }),
    });

    if (res.status === 202) {
      return { success: true, referenceId: params.reference, status: "pending", message: "Request to pay initiated" };
    }
    const body = await res.json().catch(() => ({})) as { message?: string };
    return { success: false, status: "error", message: body.message || `MTN MoMo error: ${res.status}` };
  } catch (err) {
    console.error("[mtnMomo] requestToPay error:", err);
    return { success: false, status: "error", message: "Network error contacting MTN MoMo" };
  }
}

export async function getRequestToPayStatus(referenceId: string): Promise<{ success: boolean; status: string; financialTransactionId?: string; reason?: string }> {
  const subscriptionKey = process.env.MTN_COLLECTION_SUBSCRIPTION_KEY;
  if (!subscriptionKey) return { success: false, status: "error" };

  try {
    const token = await getToken("collection");
    const res = await fetch(`${BASE}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": TARGET_ENV,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    const data = await res.json() as { status?: string; financialTransactionId?: string; reason?: { code?: string; message?: string } };
    return {
      success: true,
      status: data.status || "UNKNOWN",
      financialTransactionId: data.financialTransactionId,
      reason: data.reason?.message,
    };
  } catch (err) {
    console.error("[mtnMomo] getRequestToPayStatus error:", err);
    return { success: false, status: "error" };
  }
}

export async function transfer(params: {
  amount: number;
  currency: string;
  phone: string;
  reference: string;
  payerMessage: string;
  payeeNote: string;
  callbackUrl?: string;
}): Promise<{ success: boolean; referenceId?: string; status: string; message: string }> {
  const subscriptionKey = process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    return { success: false, status: "error", message: "MTN MoMo disbursements not configured" };
  }

  try {
    const token = await getToken("disbursement");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": params.reference,
      "X-Target-Environment": TARGET_ENV,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    };
    if (params.callbackUrl) headers["X-Callback-Url"] = params.callbackUrl;

    const res = await fetch(`${BASE}/disbursement/v1_0/transfer`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        amount: String(params.amount),
        currency: params.currency,
        externalId: params.reference,
        payee: { partyIdType: "MSISDN", partyId: params.phone },
        payerMessage: params.payerMessage,
        payeeNote: params.payeeNote,
      }),
    });

    if (res.status === 202) {
      return { success: true, referenceId: params.reference, status: "pending", message: "Transfer initiated" };
    }
    const body = await res.json().catch(() => ({})) as { message?: string };
    return { success: false, status: "error", message: body.message || `MTN MoMo error: ${res.status}` };
  } catch (err) {
    console.error("[mtnMomo] transfer error:", err);
    return { success: false, status: "error", message: "Network error contacting MTN MoMo" };
  }
}

export function detectProvider(phone: string, country: string): "flutterwave" | "mpesa" | "mtn_momo" | "airtel" {
  const upper = country.toUpperCase();
  const p = phone.replace(/\D/g, "");

  if (upper === "KE" || p.startsWith("254")) return "mpesa";
  if (upper === "GH" || upper === "UG" || upper === "RW" || upper === "CM" || upper === "CI") return "mtn_momo";
  if (upper === "TZ" || upper === "NG") return "airtel";
  return "flutterwave";
}
