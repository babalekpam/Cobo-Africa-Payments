import { chargeMobileMoney as flutterwaveCharge } from "./flutterwave.js";
import { initiateSTKPush, formatPhone } from "./mpesa.js";
import { requestToPay as mtnRequestToPay } from "./mtnMomo.js";
import { initiatePayment as airtelInitiate } from "./airtelMoney.js";

export type PaymentProvider = "flutterwave" | "mpesa" | "mtn_momo" | "airtel" | "mock";

export interface PaymentResult {
  success: boolean;
  provider: PaymentProvider;
  providerReference?: string;
  status: "pending" | "success" | "failed";
  message: string;
  requiresAction?: boolean;
  data?: unknown;
}

export function selectProvider(params: {
  currency: string;
  country: string;
  provider: string;
}): PaymentProvider {
  const p = (params.provider || "").toLowerCase();
  const c = params.currency.toUpperCase();

  if (!process.env.FLUTTERWAVE_SECRET_KEY && !process.env.MPESA_CONSUMER_KEY && !process.env.MTN_COLLECTION_SUBSCRIPTION_KEY && !process.env.AIRTEL_CLIENT_ID) {
    return "mock";
  }

  if (p.includes("pesa")) return "mpesa";
  if (p.includes("mtn")) return "mtn_momo";
  if (p.includes("airtel")) return "airtel";

  if (c === "KES") return process.env.MPESA_CONSUMER_KEY ? "mpesa" : "flutterwave";
  if (["GHS", "UGX", "RWF", "ZMW", "TZS", "XOF", "XAF"].includes(c)) return "flutterwave";

  return "flutterwave";
}

export async function initiateTransfer(params: {
  amount: number;
  currency: string;
  phone: string;
  email: string;
  name: string;
  reference: string;
  country: string;
  providerName: string;
  callbackUrl: string;
}): Promise<PaymentResult> {
  const provider = selectProvider({ currency: params.currency, country: params.country, provider: params.providerName });

  if (provider === "mock") {
    console.warn("[paymentGateway] No payment gateway keys configured — using mock mode");
    return {
      success: true,
      provider: "mock",
      providerReference: `MOCK-${params.reference}`,
      status: "success",
      message: "Payment completed (mock mode — no gateway keys configured)",
    };
  }

  if (provider === "mpesa") {
    const phone = formatPhone(params.phone);
    const result = await initiateSTKPush({
      phone,
      amount: params.amount,
      reference: params.reference,
      description: `IAPAY transfer to ${params.name}`,
      callbackUrl: params.callbackUrl,
    });
    return {
      success: result.success,
      provider: "mpesa",
      providerReference: result.checkoutRequestId,
      status: result.success ? "pending" : "failed",
      message: result.message,
      requiresAction: result.success,
    };
  }

  if (provider === "mtn_momo") {
    const result = await mtnRequestToPay({
      amount: params.amount,
      currency: params.currency,
      phone: params.phone,
      reference: params.reference,
      payerMessage: `IAPAY payment from ${params.name}`,
      payeeNote: `Ref: ${params.reference}`,
      callbackUrl: params.callbackUrl,
    });
    return {
      success: result.success,
      provider: "mtn_momo",
      providerReference: result.referenceId,
      status: result.success ? "pending" : "failed",
      message: result.message,
      requiresAction: result.success,
    };
  }

  if (provider === "airtel") {
    const result = await airtelInitiate({
      phone: params.phone,
      amount: params.amount,
      currency: params.currency,
      country: params.country || "KE",
      reference: params.reference,
      name: params.name,
    });
    return {
      success: result.success,
      provider: "airtel",
      providerReference: result.transactionId,
      status: result.success ? "pending" : "failed",
      message: result.message,
      requiresAction: result.success,
    };
  }

  // flutterwave
  const result = await flutterwaveCharge({
    amount: params.amount,
    currency: params.currency,
    phone: params.phone,
    email: params.email,
    name: params.name,
    reference: params.reference,
  });

  const isSuccess = result.success && (result.status === "successful" || result.status === "success");
  return {
    success: result.success,
    provider: "flutterwave",
    providerReference: result.providerReference,
    status: isSuccess ? "success" : result.success ? "pending" : "failed",
    message: result.message,
    requiresAction: result.success && !isSuccess,
    data: result.data,
  };
}
