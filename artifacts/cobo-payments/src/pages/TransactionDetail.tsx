import { useGetTransaction, useUpdateTransaction, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Copy, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";

function statusColor(status: string) {
  switch (status) {
    case "completed": return "text-primary bg-primary/10 border-primary/20";
    case "pending": return "text-accent bg-accent/10 border-accent/20";
    case "failed": return "text-destructive bg-destructive/10 border-destructive/20";
    case "refunded": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

export default function TransactionDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  const { data: tx, isLoading } = useGetTransaction(id, { query: { enabled: !!id } });
  const updateMutation = useUpdateTransaction();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        },
      }
    );
  };

  const copyRef = () => {
    navigator.clipboard.writeText(tx?.reference ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
          <div className="h-8 bg-card rounded w-48" />
          <div className="h-48 bg-card rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!tx) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-muted-foreground">Transaction not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/transactions")}>Back to Transactions</Button>
        </div>
      </Layout>
    );
  }

  const rows = [
    ["Reference", <span className="font-mono text-xs flex items-center gap-2">{tx.reference} <button onClick={copyRef}>{copied ? <CheckCircle className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}</button></span>],
    ["Amount", `$${Number(tx.amount).toLocaleString()} ${tx.currency}`],
    ["Type", <span className="capitalize">{tx.type}</span>],
    ["Payment Method", tx.paymentMethod ?? "—"],
    ["Merchant", tx.merchantName ?? "—"],
    ["Country", tx.country ?? "—"],
    ["Description", tx.description ?? "—"],
    ["Created", format(new Date(tx.createdAt), "PPpp")],
    ["Updated", format(new Date(tx.updatedAt), "PPpp")],
  ];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" data-testid="button-back" onClick={() => setLocation("/transactions")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-foreground" data-testid="text-transaction-title">Transaction Detail</h1>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 space-y-6">
          {/* Status header */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColor(tx.status)}`} data-testid="status-transaction">
              {tx.status}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Update status:</span>
              <Select value={tx.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-36 h-8 text-xs bg-card border-border" data-testid="select-update-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Details grid */}
          <dl className="space-y-3">
            {rows.map(([label, value], i) => (
              <div key={i} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                <dt className="text-sm text-muted-foreground w-36 shrink-0">{label as string}</dt>
                <dd className="text-sm text-foreground text-right flex-1" data-testid={`text-${String(label).toLowerCase().replace(/\s+/g, '-')}`}>{value as any}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Layout>
  );
}
