import { useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

const WALLET_CURRENCIES: { code: string; name: string; symbol: string; flag: string; region: string }[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", region: "Global" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", region: "Global" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", region: "Global" },

  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬", region: "West Africa" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", flag: "🇬🇭", region: "West Africa" },
  { code: "XOF", name: "CFA Franc (West)", symbol: "CFA", flag: "🏦", region: "West Africa" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D", flag: "🇬🇲", region: "West Africa" },
  { code: "SLL", name: "Sierra Leonean Leone", symbol: "Le", flag: "🇸🇱", region: "West Africa" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG", flag: "🇬🇳", region: "West Africa" },
  { code: "LRD", name: "Liberian Dollar", symbol: "L$", flag: "🇱🇷", region: "West Africa" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "CVE", flag: "🇨🇻", region: "West Africa" },
  { code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM", flag: "🇲🇷", region: "West Africa" },

  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪", region: "East Africa" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", flag: "🇹🇿", region: "East Africa" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", flag: "🇺🇬", region: "East Africa" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", flag: "🇪🇹", region: "East Africa" },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", flag: "🇷🇼", region: "East Africa" },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh", flag: "🇸🇴", region: "East Africa" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj", flag: "🇩🇯", region: "East Africa" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk", flag: "🇪🇷", region: "East Africa" },
  { code: "SSP", name: "South Sudanese Pound", symbol: "SSP", flag: "🇸🇸", region: "East Africa" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu", flag: "🇧🇮", region: "East Africa" },
  { code: "KMF", name: "Comorian Franc", symbol: "KMF", flag: "🇰🇲", region: "East Africa" },

  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦", region: "Southern Africa" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", flag: "🇲🇿", region: "Southern Africa" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", flag: "🇿🇲", region: "Southern Africa" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", flag: "🇲🇼", region: "Southern Africa" },
  { code: "BWP", name: "Botswana Pula", symbol: "P", flag: "🇧🇼", region: "Southern Africa" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", flag: "🇦🇴", region: "Southern Africa" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$", flag: "🇳🇦", region: "Southern Africa" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L", flag: "🇱🇸", region: "Southern Africa" },
  { code: "SZL", name: "Eswatini Lilangeni", symbol: "E", flag: "🇸🇿", region: "Southern Africa" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar", flag: "🇲🇬", region: "Southern Africa" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "Rs", flag: "🇲🇺", region: "Southern Africa" },
  { code: "SCR", name: "Seychellois Rupee", symbol: "SCR", flag: "🇸🇨", region: "Southern Africa" },

  { code: "EGP", name: "Egyptian Pound", symbol: "E£", flag: "🇪🇬", region: "North Africa" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD", flag: "🇲🇦", region: "North Africa" },
  { code: "TND", name: "Tunisian Dinar", symbol: "DT", flag: "🇹🇳", region: "North Africa" },
  { code: "DZD", name: "Algerian Dinar", symbol: "DA", flag: "🇩🇿", region: "North Africa" },
  { code: "LYD", name: "Libyan Dinar", symbol: "LD", flag: "🇱🇾", region: "North Africa" },
  { code: "SDG", name: "Sudanese Pound", symbol: "SDG", flag: "🇸🇩", region: "North Africa" },

  { code: "XAF", name: "CFA Franc (Central)", symbol: "FCFA", flag: "🏦", region: "Central Africa" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC", flag: "🇨🇩", region: "Central Africa" },
  { code: "STN", name: "São Tomé Dobra", symbol: "Db", flag: "🇸🇹", region: "Central Africa" },
];

const CURRENCY_MAP = Object.fromEntries(WALLET_CURRENCIES.map(c => [c.code, c]));
const REGIONS = ["Global", "West Africa", "East Africa", "Southern Africa", "North Africa", "Central Africa"];

export default function Wallets() {
  const { wallets, refreshWallets } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fundModal, setFundModal] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [fundLoading, setFundLoading] = useState(false);

  const addWallet = async () => {
    setLoading(true);
    try {
      await api.post("/wallets", { currency });
      await refreshWallets();
      setShowAdd(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add wallet");
    }
    setLoading(false);
  };

  const setDefault = async (id: number) => {
    await api.put(`/wallets/${id}/default`);
    await refreshWallets();
  };

  const fundWallet = async () => {
    if (!fundModal || !fundAmount || Number(fundAmount) <= 0) return;
    setFundLoading(true);
    try {
      const w = wallets.find(w => w.id === fundModal);
      await api.post("/wallets/fund", { currency: w?.currency, amount: Number(fundAmount) });
      await refreshWallets();
      setFundModal(null);
      setFundAmount("");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to fund wallet");
    }
    setFundLoading(false);
  };

  const availableCurrencies = WALLET_CURRENCIES.filter(c =>
    !wallets.find(w => w.currency === c.code) &&
    (search === "" || c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase()) || c.region.toLowerCase().includes(search.toLowerCase()))
  );

  const groupedCurrencies = REGIONS.map(region => ({
    region,
    currencies: availableCurrencies.filter(c => c.region === region),
  })).filter(g => g.currencies.length > 0);

  return (
    <Layout>
      <div className="page fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Wallets</h1>
            <p className="page-subtitle">Manage your multi-currency wallets across Africa</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Wallet</button>
        </div>

        {wallets.length === 0 ? (
          <div className="card"><div className="empty"><div className="empty-icon">💰</div><div className="empty-title">No wallets</div><div className="empty-desc">Add your first wallet to start transacting</div></div></div>
        ) : (
          <div className="grid-3">
            {wallets.map(w => {
              const info = CURRENCY_MAP[w.currency];
              return (
                <div key={w.id} className="card" style={{ position: "relative" }}>
                  {w.isDefault && <span className="badge badge-warning" style={{ position: "absolute", top: 16, right: 16 }}>Default</span>}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{info?.flag || "💰"}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{w.currency} Wallet</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{info?.name || w.currency}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 26, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-dim)" }}>{info?.symbol || w.currency} </span>
                    {w.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  {w.lockedBalance > 0 && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>Locked: {info?.symbol} {w.lockedBalance.toLocaleString()}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {!w.isDefault && <button className="btn btn-ghost btn-sm" onClick={() => setDefault(w.id)}>Set Default</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => { setFundModal(w.id); setFundAmount(""); }}>+ Fund</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <div className="card-lg fade-in" style={{ width: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Add New Wallet</h3>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <input className="input" placeholder="Search currencies..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 14 }} />
              </div>

              <div style={{ flex: 1, overflowY: "auto", maxHeight: 400, marginBottom: 16 }}>
                {groupedCurrencies.map(group => (
                  <div key={group.region} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, padding: "0 4px" }}>{group.region}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {group.currencies.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setCurrency(c.code)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "10px 12px",
                            border: currency === c.code ? "2px solid var(--gold)" : "1px solid var(--surface2)",
                            borderRadius: 10,
                            background: currency === c.code ? "rgba(201,138,26,0.08)" : "var(--surface)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{c.flag}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: currency === c.code ? 700 : 600, color: currency === c.code ? "var(--gold)" : "var(--text)" }}>{c.code}</div>
                            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{c.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedCurrencies.length === 0 && (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-dim)", fontSize: 14 }}>
                    {search ? "No matching currencies found" : "You already have wallets for all currencies"}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowAdd(false); setSearch(""); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={addWallet} disabled={loading}>
                  {loading ? <span className="spinner" /> : `Create ${currency} Wallet`}
                </button>
              </div>
            </div>
          </div>
        )}

        {fundModal && (
          <div className="modal-overlay" onClick={() => setFundModal(null)}>
            <div className="card-lg fade-in" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
              {(() => { const w = wallets.find(w => w.id === fundModal); const info = w ? CURRENCY_MAP[w.currency] : null; return (
                <>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Fund Wallet</h3>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>{info?.flag} {w?.currency} — {info?.name} (Sandbox)</p>
                  <div className="input-group" style={{ marginBottom: 20 }}>
                    <label className="input-label">Amount ({info?.symbol || w?.currency})</label>
                    <input className="input" type="number" min="0" step="0.01" max="100000" value={fundAmount} onChange={e => setFundAmount(e.target.value)} placeholder="0.00" style={{ fontSize: 18, fontWeight: 600 }} />
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Max 100,000 per funding (sandbox mode)</div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setFundModal(null)}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={fundWallet} disabled={fundLoading || !fundAmount || Number(fundAmount) <= 0}>
                      {fundLoading ? <span className="spinner" /> : `Fund ${info?.symbol || ""}${fundAmount || "0"}`}
                    </button>
                  </div>
                </>
              ); })()}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
