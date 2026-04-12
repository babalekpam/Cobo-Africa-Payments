import { useState } from "react";
import { useListTransactions, useCreateTransaction, useListMerchants, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, ChevronLeft, ChevronRight, ArrowLeftRight, Plus, Download } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

function statusColor(status: string) {
  switch (status) {
    case "completed": return "text-primary bg-primary/10 border-primary/20";
    case "pending": return "text-accent bg-accent/10 border-accent/20";
    case "failed": return "text-destructive bg-destructive/10 border-destructive/20";
    case "refunded": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

const txSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be > 0"),
  currency: z.string().min(1, "Required"),
  type: z.enum(["payment", "payout", "transfer", "refund"]),
  merchantId: z.coerce.number().optional(),
  description: z.string().optional(),
  country: z.string().optional(),
  paymentMethod: z.string().optional(),
});
type TxForm = z.infer<typeof txSchema>;

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useListTransactions({
    page,
    limit: 20,
    ...(search && { search }),
    ...(status && status !== "all" && { status: status as any }),
  });

  const { data: merchantsData } = useListMerchants({ limit: 100 });
  const merchants = merchantsData?.data ?? [];

  const createMutation = useCreateTransaction({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        setDialogOpen(false);
        reset();
      },
    },
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TxForm>({
    resolver: zodResolver(txSchema),
    defaultValues: { currency: "USD", type: "payment" },
  });
  const selectedType = watch("type");

  const onSubmit = (d: TxForm) => {
    createMutation.mutate({ data: { ...d, merchantId: d.merchantId || undefined } });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const exportCsv = () => {
    if (!data?.data?.length) return;
    const headers = ["Reference", "Amount", "Currency", "Type", "Merchant", "Country", "Status", "Payment Method", "Date"];
    const rows = data.data.map((tx) => [
      tx.reference,
      tx.amount,
      tx.currency,
      tx.type,
      tx.merchantName ?? "",
      tx.country ?? "",
      tx.status,
      tx.paymentMethod ?? "",
      format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm:ss"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-transactions-title">Transactions</h1>
            <p className="text-sm text-muted-foreground">{data?.total ?? 0} total transactions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.data?.length} data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-transaction">
                  <Plus className="w-4 h-4 mr-1" /> New Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-card-border">
                <DialogHeader>
                  <DialogTitle>Create Transaction</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input {...register("amount")} type="number" step="0.01" placeholder="1000" className="bg-input border-border" data-testid="input-tx-amount" />
                      {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Currency</Label>
                      <Input {...register("currency")} placeholder="USD" className="bg-input border-border" data-testid="input-tx-currency" />
                      {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={selectedType} onValueChange={(v) => setValue("type", v as any)}>
                        <SelectTrigger className="bg-input border-border" data-testid="select-tx-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payment">Payment</SelectItem>
                          <SelectItem value="payout">Payout</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="refund">Refund</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Merchant</Label>
                      <Select onValueChange={(v) => setValue("merchantId", parseInt(v))}>
                        <SelectTrigger className="bg-input border-border" data-testid="select-tx-merchant"><SelectValue placeholder="Select merchant" /></SelectTrigger>
                        <SelectContent>
                          {merchants.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Input {...register("country")} placeholder="Kenya" className="bg-input border-border" data-testid="input-tx-country" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Payment Method</Label>
                      <Input {...register("paymentMethod")} placeholder="M-Pesa, Card..." className="bg-input border-border" data-testid="input-tx-method" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input {...register("description")} placeholder="Payment description..." className="bg-input border-border" data-testid="input-tx-description" />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-transaction">
                    {createMutation.isPending ? "Creating..." : "Create Transaction"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reference..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 bg-card border-border"
                data-testid="input-search"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" data-testid="button-search">Search</Button>
          </form>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-card border-border" data-testid="select-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Merchant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Country</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No transactions found</td>
                  </tr>
                ) : data?.data?.map((tx) => (
                  <tr key={tx.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`row-transaction-${tx.id}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground">{tx.reference}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      ${Number(tx.amount).toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{tx.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{tx.merchantName ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="capitalize text-muted-foreground">{tx.type}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{tx.country ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                      {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`link-transaction-${tx.id}`}
                        onClick={() => setLocation(`/transactions/${tx.id}`)}
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {data.totalPages} · {data.total} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  data-testid="button-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
