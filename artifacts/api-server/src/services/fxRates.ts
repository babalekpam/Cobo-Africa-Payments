const FALLBACK_RATES: Record<string, number> = {
  NGN: 1580, GHS: 14.5, XOF: 620, XAF: 620, KES: 129, ZAR: 18.9, EGP: 48.5,
  MAD: 10.1, TZS: 2540, UGX: 3750, ETB: 57.5, RWF: 1290,
  CDF: 2780, AOA: 830, MZN: 63.8, BWP: 13.6, MWK: 1720, ZMW: 26.5,
  SDG: 601, TND: 3.12, DZD: 134.5, LYD: 4.85,
  GMD: 67.5, SLL: 22500, GNF: 8600, CVE: 102, STN: 23.2,
  SCR: 14.2, MUR: 45.5, MGA: 4520, KMF: 460, DJF: 177.7,
  ERN: 15, SOS: 571, SSP: 1320, BIF: 2870, LSL: 18.9, SZL: 18.9, NAD: 18.9,
  LRD: 192, MRU: 39.7, EUR: 0.92, GBP: 0.79, CAD: 1.36, CHF: 0.88,
  SEK: 10.85, NOK: 10.65, DKK: 6.88, PLN: 4.02, CZK: 23.2,
};

let cachedRates: Record<string, number> = { USD: 1, ...FALLBACK_RATES };
let lastFetch = 0;
const CACHE_TTL = 3600000;

async function fetchRates(): Promise<void> {
  const key = process.env.EXCHANGERATE_API_KEY;
  if (!key) return;

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/USD`);
    if (!res.ok) return;
    const data = await res.json() as { result: string; conversion_rates: Record<string, number> };
    if (data.result === "success" && data.conversion_rates) {
      cachedRates = { USD: 1, ...data.conversion_rates };
      lastFetch = Date.now();
    }
  } catch {
    // fall through to cached/fallback rates
  }
}

export async function initFxRates(): Promise<void> {
  await fetchRates();
  setInterval(() => { fetchRates().catch(() => {}); }, CACHE_TTL);
}

export async function getAllRates(): Promise<Record<string, number>> {
  if (Date.now() - lastFetch > CACHE_TTL) {
    await fetchRates();
  }
  return cachedRates;
}

export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  const rates = await getAllRates();
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate && toRate) return toRate / fromRate;
  return null;
}
