import { useListTransactions, useListMerchants, useListUsers } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ArrowLeftRight, Store, Users, DollarSign, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function activityIcon(status: string, type: string) {
  if (status === "completed") return <CheckCircle className="w-4 h-4 text-primary" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-destructive" />;
  if (status === "pending") return <Clock className="w-4 h-4 text-accent" />;
  if (status === "refunded") return <AlertTriangle className="w-4 h-4 text-chart-3" />;
  return <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />;
}

export default function ActivityLog() {
  const { data: txData, isLoading: txLoading } = useListTransactions({ limit: 50 });
  const { data: merchantData } = useListMerchants({ limit: 100 });
  const { data: userData } = useListUsers({ limit: 100 });

  const activities = [
    ...(txData?.data ?? []).map((tx) => ({
      id: `tx-${tx.id}`,
      type: "transaction" as const,
      icon: activityIcon(tx.status, tx.type),
      title: `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} — $${Number(tx.amount).toLocaleString()} ${tx.currency}`,
      detail: `${tx.merchantName ?? "Unknown"} · ${tx.country ?? "—"} · Ref: ${tx.reference}`,
      status: tx.status,
      time: new Date(tx.createdAt),
    })),
    ...(merchantData?.data ?? [])
      .filter((m) => m.status === "pending")
      .map((m) => ({
        id: `m-${m.id}`,
        type: "merchant" as const,
        icon: <Store className="w-4 h-4 text-accent" />,
        title: `Merchant pending approval: ${m.name}`,
        detail: `${m.country} · ${m.email}`,
        status: "pending",
        time: new Date(m.createdAt),
      })),
    ...(userData?.data ?? [])
      .filter((u) => u.status === "suspended")
      .map((u) => ({
        id: `u-${u.id}`,
        type: "user" as const,
        icon: <Users className="w-4 h-4 text-destructive" />,
        title: `User suspended: ${u.name}`,
        detail: `${u.email} · ${u.role}`,
        status: "suspended",
        time: new Date(u.updatedAt ?? u.createdAt),
      })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime());

  const statusColor: Record<string, string> = {
    completed: "text-primary bg-primary/10",
    pending: "text-accent bg-accent/10",
    failed: "text-destructive bg-destructive/10",
    refunded: "text-chart-3 bg-chart-3/10",
    suspended: "text-destructive bg-destructive/10",
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-activity-title">Activity Log</h1>
          <p className="text-sm text-muted-foreground">Recent platform activity and events</p>
        </div>

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {txLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent activity</div>
          ) : (
            <div className="divide-y divide-border">
              {activities.slice(0, 50).map((act) => (
                <div key={act.id} className="flex items-start gap-3 px-5 py-4 hover:bg-muted/20 transition-colors" data-testid={`activity-${act.id}`}>
                  <div className="mt-0.5 shrink-0">{act.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{act.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{act.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize ${statusColor[act.status] ?? "text-muted-foreground bg-muted"}`}>
                      {act.status}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(act.time, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
