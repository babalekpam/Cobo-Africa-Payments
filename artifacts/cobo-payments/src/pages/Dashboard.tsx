import { useGetDashboardSummary, useGetRecentTransactions, useGetVolumeByCountry, useGetMonthlyVolume, useGetTopMerchants } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ArrowUpRight, ArrowDownRight, TrendingUp, Activity, Store, Users, Clock, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatDistanceToNow } from "date-fns";

function StatCard({ title, value, subtitle, icon: Icon, trend, trendPositive }: {
  title: string; value: string; subtitle?: string; icon: any; trend?: string; trendPositive?: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5" data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendPositive ? "text-primary" : "text-destructive"}`}>
            {trendPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "completed": return "text-primary bg-primary/10";
    case "pending": return "text-accent bg-accent/10";
    case "failed": return "text-destructive bg-destructive/10";
    case "refunded": return "text-chart-3 bg-chart-3/10";
    default: return "text-muted-foreground bg-muted";
  }
}

export default function Dashboard() {
  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary();
  const { data: recent } = useGetRecentTransactions({ limit: 8 });
  const { data: countryVolume } = useGetVolumeByCountry();
  const { data: monthlyVolume } = useGetMonthlyVolume();
  const { data: topMerchants } = useGetTopMerchants({ limit: 5 });

  const formatAmount = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n.toFixed(0)}`;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Africa Payments Overview</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {sumLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-5 animate-pulse h-32" />
            ))
          ) : (
            <>
              <StatCard
                title="Total Volume"
                value={formatAmount(summary?.totalVolume ?? 0)}
                icon={TrendingUp}
                trend={`${summary?.volumeGrowth ?? 0}%`}
                trendPositive
              />
              <StatCard
                title="Transactions"
                value={(summary?.totalTransactions ?? 0).toLocaleString()}
                icon={Activity}
                trend={`${summary?.transactionGrowth ?? 0}%`}
                trendPositive
              />
              <StatCard
                title="Success Rate"
                value={`${summary?.successRate ?? 0}%`}
                icon={CheckCircle}
              />
              <StatCard
                title="Active Merchants"
                value={(summary?.activeMerchants ?? 0).toString()}
                icon={Store}
                subtitle={`${summary?.pendingTransactions ?? 0} pending txns`}
              />
            </>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Volume */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Monthly Volume</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyVolume ?? []}>
                <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 14%)", border: "1px solid hsl(216 34% 20%)", borderRadius: 8, color: "hsl(213 31% 91%)" }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]}
                />
                <Bar dataKey="volume" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Country Volume */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Volume by Country</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(countryVolume ?? []).slice(0, 7)} layout="vertical">
                <XAxis type="number" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="country" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 14%)", border: "1px solid hsl(216 34% 20%)", borderRadius: 8, color: "hsl(213 31% 91%)" }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Volume"]}
                />
                <Bar dataKey="volume" fill="hsl(38 95% 56%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h2>
            <div className="space-y-2">
              {(recent ?? []).map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0" data-testid={`row-transaction-${tx.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate font-mono">{tx.reference}</p>
                    <p className="text-xs text-muted-foreground">{tx.merchantName ?? "—"} · {tx.country}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">${Number(tx.amount).toLocaleString()}</p>
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
              {!recent?.length && (
                <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet</p>
              )}
            </div>
          </div>

          {/* Top Merchants */}
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Top Merchants</h2>
            <div className="space-y-3">
              {(topMerchants ?? []).map((m, i) => (
                <div key={m.id} className="flex items-center gap-3" data-testid={`row-merchant-${m.id}`}>
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.country} · {m.count} txns</p>
                  </div>
                  <p className="text-sm font-semibold text-primary shrink-0">{formatAmount(m.volume)}</p>
                </div>
              ))}
              {!topMerchants?.length && (
                <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
