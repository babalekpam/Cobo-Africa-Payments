const BASE = process.env.NODE_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa credentials not configured");

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  const data = await res.json() as { access_token: string; expires_in: string };
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  return cachedToken;
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

export async function initiateSTKPush(params: {
  phone: string;
  amount: number;
  reference: string;
  description: string;
  callbackUrl: string;
}): Promise<{ success: boolean; checkoutRequestId?: string; merchantRequestId?: string; message: string }> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!key || !shortCode || !passkey) {
    return { success: false, message: "M-Pesa not configured" };
  }

  try {
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");

    const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(params.amount),
        PartyA: params.phone,
        PartyB: shortCode,
        PhoneNumber: params.phone,
        CallBackURL: params.callbackUrl,
        AccountReference: params.reference,
        TransactionDesc: params.description,
      }),
    });

    const data = await res.json() as { ResponseCode?: string; ResponseDescription?: string; CheckoutRequestID?: string; MerchantRequestID?: string; errorMessage?: string };
    if (data.ResponseCode === "0") {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        message: data.ResponseDescription || "STK push sent",
      };
    }
    return { success: false, message: data.errorMessage || data.ResponseDescription || "STK push failed" };
  } catch (err) {
    console.error("[mpesa] initiateSTKPush error:", err);
    return { success: false, message: "Network error contacting M-Pesa" };
  }
}

export async function querySTKPush(checkoutRequestId: string): Promise<{ success: boolean; status: string; resultCode?: string; resultDesc?: string }> {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;
  if (!shortCode || !passkey) return { success: false, status: "error" };

  try {
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");

    const res = await fetch(`${BASE}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });

    const data = await res.json() as { ResultCode?: string; ResultDesc?: string };
    return {
      success: true,
      status: data.ResultCode === "0" ? "success" : "failed",
      resultCode: data.ResultCode,
      resultDesc: data.ResultDesc,
    };
  } catch (err) {
    console.error("[mpesa] querySTKPush error:", err);
    return { success: false, status: "error" };
  }
}

export async function sendToPhone(params: {
  phone: string;
  amount: number;
  reference: string;
  remarks: string;
  callbackUrl: string;
}): Promise<{ success: boolean; conversationId?: string; message: string }> {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const initiatorName = process.env.MPESA_INITIATOR_NAME;
  const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL;

  if (!shortCode || !initiatorName || !securityCredential) {
    return { success: false, message: "M-Pesa B2C not configured" };
  }

  try {
    const token = await getAccessToken();
    const res = await fetch(`${BASE}/mpesa/b2c/v3/paymentrequest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: "BusinessPayment",
        Amount: Math.ceil(params.amount),
        PartyA: shortCode,
        PartyB: params.phone,
        Remarks: params.remarks,
        QueueTimeOutURL: params.callbackUrl,
        ResultURL: params.callbackUrl,
        Occassion: params.reference,
      }),
    });

    const data = await res.json() as { ResponseCode?: string; ResponseDescription?: string; ConversationID?: string };
    if (data.ResponseCode === "0") {
      return { success: true, conversationId: data.ConversationID, message: data.ResponseDescription || "B2C initiated" };
    }
    return { success: false, message: data.ResponseDescription || "B2C failed" };
  } catch (err) {
    console.error("[mpesa] sendToPhone error:", err);
    return { success: false, message: "Network error contacting M-Pesa" };
  }
}

export function formatPhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (!p.startsWith("254")) p = "254" + p;
  return p;
}
