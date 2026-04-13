import { randomUUID } from "crypto";

export function generateRef(prefix: string = "COBO"): string {
  const uuid = randomUUID().replace(/-/g, "").substring(0, 12).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${ts}-${uuid}`;
}

export function generateDepositRef(): string {
  return generateRef("DEP");
}

export function generateBankRef(): string {
  return generateRef("BANK");
}

export function generateMobileRef(): string {
  return generateRef("MOMO");
}

export function generateInternalRef(): string {
  return generateRef("INT");
}

export function generateFxRef(): string {
  return generateRef("FX");
}

export function generateCheckoutRef(): string {
  return generateRef("PAY");
}
