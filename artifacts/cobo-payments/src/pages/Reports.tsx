import { useGetDashboardSummary, useGetVolumeByCountry, useGetMonthlyVolume, useGetTopMerchants, useListTransactions } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { Download, TrendingUp, DollarSign, Activity, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const COLORS = ["hsl(142 71% 45%)", "hsl(38 95% 56%)", "hsl(199 89% 48%)", "hsl(271 81% 56%)", "hsl(0 72% 51%)", "hsl(160 60% 45%)", "hsl(30 80% 55%)"];

export default function Reports() {
  const { data: summary } = useGetDashboardSummary();
  const { data: countryVolume } = useGetVolumeByCountry();
  const { data: monthlyVolume } = useGetMonthlyVolume();
  const { data: topMerchants } = useGetTopMerchants({ limit: 10 });
  const { data: allTx } = useListTransactions({ limit: 1000 });

  const statusBreakdown = (() => {
    if (!allTx?.data) return [];
    const counts: Record<string, number> = {};
    allTx.data.forEach((tx) => {
      counts[tx.status] = (counts[tx.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const typeBreakdown = (() => {
    if (!allTx?.data) return [];
    const sums: Record<string, number> = {};
    allTx.data.forEach((tx) => {
      sums[tx.type] = (sums[tx.type] || 0) + Number(tx.amount);
    });
    return Object.entries(sums).map(([name, value]) => ({ name, value: Math.round(value) }));
  })();

  const paymentMethodBreakdown = (() => {
    if (!allTx?.data) return [];
    const sums: Record<string, number> = {};
    allTx.data.forEach((tx) => {
      const method = tx.paymentMethod || "Other";
      sums[method] = (sums[method] || 0) + 1;
    });
    return Object.entries(sums)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const formatAmount = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`;

  const exportReport = () => {
    const lines = [
      "COBO Africa Payments - Report",
      `Generated: ${format(new Date(), "PPpp")}`,
      "",
      "=== Summary ===",
      `Total Volume: ${formatAmount(summary?.totalVolume ?? 0)}`,
      `Total Transactions: ${summary?.totalTransactions ?? 0}`,
      `Success Rate: ${summary?.successRate ?? 0}%`,
      `Active Merchants: ${summary?.activeMerchants ?? 0}`,
      "",
      "=== Volume by Country ===",
      ...(countryVolume ?? []).map((c) => `${c.country}: ${formatAmount(c.volume)} (${c.count} txns)`),
      "",
      "=== Top Merchants ===",
      ...(topMerchants ?? []).map((m, i) => `${i + 1}. ${m.name} - ${formatAmount(m.volume)} (${m.count} txns)`),
      "",
      "=== Monthly Volume ===",
      ...(monthlyVolume ?? []).map((m) => `${m.month}: ${formatAmount(m.volume)}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobo-report-${format(new Date(), "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tooltipStyle = { background: "hsl(222 47% 14%)", border: "1px solid hsl(216 34% 20%)", borderRadius: 8, color: "hsl(213 31% 91%)" };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-reports-title">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">Detailed platform performance data</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportReport} data-testid="button-export-report">
            <Download className="w-4 h-4 mr-1" /> Export Report
          </Button>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: DollarSign, label: "Total Volume", value: formatAmount(summary?.totalVolume ?? 0), color: "text-primary" },
            { icon: Activity, label: "Transactions", value: (summary?.totalTransactions ?? 0).toLocaleString(), color: "text-chart-3" },
            { icon: TrendingUp, label: "Success Rate", value: `${summary?.successRate ?? 0}%`, color: "text-accent" },
            { icon: Globe, label: "Countries", value: (countryVolume?.length ?? 0).toString(), color: "text-chart-4" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-card-border rounded-xl p-4">
              <Icon className={`w-5 h-5 ${color} mb-2`} />
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Monthly Volume Trend (Area) */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Monthly Volume Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyVolume ?? []}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 34% 17%)" />
              <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]} />
              <Area type="monotone" dataKey="volume" stroke="hsl(142 71% 45%)" fillOpacity={1} fill="url(#volumeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status Distribution */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Transaction Status Distribution</h2>
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={false}>
                    {statusBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {statusBreakdown.map((entry, i) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground capitalize flex-1">{entry.name}</span>
                    <span className="text-xs font-medium text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Volume by Type */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Volume by Transaction Type</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeBreakdown}>
                <XAxis dataKey="name" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {typeBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Country Volume */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Volume by Country</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={(countryVolume ?? []).slice(0, 8)} layout="vertical">
                <XAxis type="number" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="country" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]} />
                <Bar dataKey="volume" fill="hsl(38 95% 56%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Methods */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Payment Methods</h2>
            <div className="space-y-3">
              {paymentMethodBreakdown.slice(0, 8).map((pm, i) => {
                const max = paymentMethodBreakdown[0]?.value ?? 1;
                const pct = Math.round((pm.value / max) * 100);
                return (
                  <div key={pm.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{pm.name}</span>
                      <span className="text-xs text-muted-foreground">{pm.value} txns</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
              {!paymentMethodBreakdown.length && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
            </div>
          </div>
        </div>

        {/* Top Merchants Table */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top Merchants by Volume</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Merchant</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Country</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Transactions</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Volume</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Share</th>
                </tr>
              </thead>
              <tbody>
                {(topMerchants ?? []).map((m, i) => {
                  const totalVol = (topMerchants ?? []).reduce((s, x) => s + x.volume, 0);
                  const share = totalVol > 0 ? ((m.volume / totalVol) * 100).toFixed(1) : "0";
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-muted-foreground font-bold">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{m.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{m.country}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{m.count}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-primary">{formatAmount(m.volume)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
