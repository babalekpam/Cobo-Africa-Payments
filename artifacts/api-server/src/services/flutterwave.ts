const BASE_URL = "https://api.flutterwave.com/v3";

function getHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
  };
}

function getMobileMoneyType(currency: string): string {
  switch (currency) {
    case "KES": return "mobile_money_kenya";
    case "GHS": return "mobile_money_ghana";
    case "UGX": return "mobile_money_uganda";
    case "RWF": return "mobile_money_rwanda";
    case "ZMW": return "mobile_money_zambia";
    case "TZS": return "mobile_money_tanzania";
    case "XOF":
    case "XAF": return "mobile_money_francophone";
    case "ZAR": return "mobile_money_south_africa";
    default: return "mobile_money_africa";
  }
}

export async function chargeMobileMoney(params: {
  amount: number;
  currency: string;
  phone: string;
  email: string;
  name: string;
  reference: string;
  redirectUrl?: string;
}): Promise<{ success: boolean; providerReference?: string; status: string; message: string; data?: unknown }> {
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return { success: false, status: "error", message: "Payment gateway not configured" };
  }

  const type = getMobileMoneyType(params.currency);

  try {
    const res = await fetch(`${BASE_URL}/charges?type=${type}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        email: params.email,
        phone_number: params.phone,
        fullname: params.name,
        tx_ref: params.reference,
        redirect_url: params.redirectUrl || "https://cob-o.com/payment-complete",
        meta: { source: "cobo_africa" },
      }),
    });

    const data = await res.json() as { status: string; message: string; data?: { id?: number; status?: string } };
    if (data.status === "success") {
      return {
        success: true,
        providerReference: data.data?.id ? String(data.data.id) : undefined,
        status: data.data?.status || "pending",
        message: data.message || "Charge initiated",
        data: data.data,
      };
    }
    return { success: false, status: "error", message: data.message || "Charge failed", data };
  } catch (err) {
    console.error("[flutterwave] chargeMobileMoney error:", err);
    return { success: false, status: "error", message: "Network error contacting Flutterwave" };
  }
}

export async function chargeCard(params: {
  amount: number;
  currency: string;
  cardNumber: string;
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  email: string;
  name: string;
  phone: string;
  reference: string;
}): Promise<{ success: boolean; providerReference?: string; status: string; message: string; requiresOtp?: boolean; data?: unknown }> {
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return { success: false, status: "error", message: "Payment gateway not configured" };
  }

  try {
    const res = await fetch(`${BASE_URL}/charges?type=card`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        card_number: params.cardNumber,
        cvv: params.cvv,
        expiry_month: params.expiryMonth,
        expiry_year: params.expiryYear,
        currency: params.currency,
        amount: params.amount,
        email: params.email,
        fullname: params.name,
        phone_number: params.phone,
        tx_ref: params.reference,
        redirect_url: "https://cob-o.com/payment-complete",
        enckey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
      }),
    });

    const data = await res.json() as { status: string; message: string; meta?: { authorization?: { mode?: string } }; data?: { id?: number } };
    if (data.status === "success") {
      return {
        success: true,
        providerReference: data.data?.id ? String(data.data.id) : undefined,
        status: "pending",
        message: data.message || "Card charge initiated",
        requiresOtp: data.meta?.authorization?.mode === "otp",
        data,
      };
    }
    return { success: false, status: "error", message: data.message || "Card charge failed", data };
  } catch (err) {
    console.error("[flutterwave] chargeCard error:", err);
    return { success: false, status: "error", message: "Network error contacting Flutterwave" };
  }
}

export async function verifyTransaction(transactionId: string): Promise<{ success: boolean; status: string; amount?: number; currency?: string; data?: unknown }> {
  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return { success: false, status: "error" };
  }

  try {
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/verify`, {
      headers: getHeaders(),
    });
    const data = await res.json() as { status: string; data?: { status?: string; amount?: number; currency?: string } };
    if (data.status === "success") {
      return {
        success: true,
        status: data.data?.status || "unknown",
        amount: data.data?.amount,
        currency: data.data?.currency,
        data: data.data,
      };
    }
    return { success: false, status: "error", data };
  } catch (err) {
    console.error("[flutterwave] verifyTransaction error:", err);
    return { success: false, status: "error" };
  }
}

export function verifyWebhookSignature(signature: string, _body: string): boolean {
  return signature === process.env.FLUTTERWAVE_WEBHOOK_HASH;
}
