import { useGetMerchant, useListTransactions, useUpdateMerchant, getListMerchantsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

function statusColor(status: string) {
  switch (status) {
    case "completed": return "text-primary bg-primary/10";
    case "pending": return "text-accent bg-accent/10";
    case "failed": return "text-destructive bg-destructive/10";
    default: return "text-muted-foreground bg-muted";
  }
}

function merchantStatusColor(status: string) {
  switch (status) {
    case "active": return "text-primary bg-primary/10 border-primary/20";
    case "pending": return "text-accent bg-accent/10 border-accent/20";
    case "suspended": return "text-destructive bg-destructive/10 border-destructive/20";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

export default function MerchantDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const { data: merchant, isLoading } = useGetMerchant(id, { query: { enabled: !!id } });
  const { data: transactions } = useListTransactions({ merchantId: id, limit: 10 });
  const updateMutation = useUpdateMerchant();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id, data: { status: newStatus as any } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMerchantsQueryKey() }) }
    );
  };

  if (isLoading) {
    return <Layout><div className="max-w-3xl mx-auto animate-pulse space-y-4"><div className="h-8 bg-card rounded w-48" /><div className="h-48 bg-card rounded-xl" /></div></Layout>;
  }

  if (!merchant) {
    return <Layout><div className="text-center py-12 text-muted-foreground">Merchant not found</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" data-testid="button-back" onClick={() => setLocation("/merchants")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h1 className="text-lg font-bold text-foreground" data-testid="text-merchant-name">{merchant.name}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Profile */}
          <div className="md:col-span-2 bg-card border border-card-border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {merchant.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{merchant.name}</h2>
                  <p className="text-sm text-muted-foreground">{merchant.email}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${merchantStatusColor(merchant.status)}`}>
                {merchant.status}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Country", merchant.country],
                ["Phone", merchant.phone ?? "—"],
                ["Business Type", merchant.businessType ?? "—"],
                ["Joined", formatDistanceToNow(new Date(merchant.createdAt), { addSuffix: true })],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground">{label as string}</dt>
                  <dd className="text-sm font-medium text-foreground mt-0.5">{value as string}</dd>
                </div>
              ))}
            </dl>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Update status</p>
              <Select value={merchant.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40 h-8 text-xs bg-card border-border" data-testid="select-merchant-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <Activity className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-primary">${(merchant.totalVolume ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Volume</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{merchant.transactionCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Transactions</h3>
          <div className="space-y-2">
            {(transactions?.data ?? []).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0" data-testid={`row-tx-${tx.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{tx.reference}</p>
                  <p className="text-xs text-muted-foreground">{tx.paymentMethod ?? tx.type} · {tx.country}</p>
                </div>
                <p className="text-sm font-semibold text-foreground shrink-0">${Number(tx.amount).toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${statusColor(tx.status)}`}>{tx.status}</span>
              </div>
            ))}
            {!transactions?.data?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
