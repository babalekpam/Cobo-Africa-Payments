import { useState } from "react";
import { useListMerchants, useCreateMerchant, useDeleteMerchant, getListMerchantsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Trash2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const merchantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  country: z.string().min(1),
  businessType: z.string().optional(),
});

type MerchantForm = z.infer<typeof merchantSchema>;

function statusColor(status: string) {
  switch (status) {
    case "active": return "text-primary bg-primary/10 border-primary/20";
    case "pending": return "text-accent bg-accent/10 border-accent/20";
    case "suspended": return "text-destructive bg-destructive/10 border-destructive/20";
    default: return "text-muted-foreground bg-muted border-border";
  }
}

export default function Merchants() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useListMerchants({
    page,
    limit: 20,
    ...(search && { search }),
    ...(status && status !== "all" && { status: status as any }),
  });

  const createMutation = useCreateMerchant({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMerchantsQueryKey() });
        setDialogOpen(false);
        reset();
      },
    },
  });

  const deleteMutation = useDeleteMerchant({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMerchantsQueryKey() });
      },
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MerchantForm>({
    resolver: zodResolver(merchantSchema),
  });

  const onSubmit = (data: MerchantForm) => {
    createMutation.mutate({ data });
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-merchants-title">Merchants</h1>
            <p className="text-sm text-muted-foreground">{data?.total ?? 0} merchants</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-merchant">
                <Plus className="w-4 h-4 mr-1" /> Add Merchant
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-card-border">
              <DialogHeader>
                <DialogTitle>Add Merchant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input {...register("name")} placeholder="Merchant name" className="bg-input border-border" data-testid="input-merchant-name" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input {...register("email")} type="email" placeholder="merchant@example.com" className="bg-input border-border" data-testid="input-merchant-email" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input {...register("phone")} placeholder="+254..." className="bg-input border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Input {...register("country")} placeholder="Kenya" className="bg-input border-border" data-testid="input-merchant-country" />
                    {errors.country && <p className="text-xs text-destructive">{errors.country.message}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Business Type</Label>
                  <Input {...register("businessType")} placeholder="E-Commerce, Fintech..." className="bg-input border-border" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-merchant">
                  {createMutation.isPending ? "Creating..." : "Create Merchant"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search merchants..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 bg-card border-border"
                data-testid="input-search-merchant"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </form>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-card border-border" data-testid="select-merchant-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-5 h-40 animate-pulse" />
            ))
          ) : data?.data?.map((m) => (
            <div key={m.id} className="bg-card border border-card-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors" data-testid={`card-merchant-${m.id}`}>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {m.name.charAt(0)}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(m.status)}`}>
                  {m.status}
                </span>
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.country} · {m.businessType ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.transactionCount ?? 0} transactions</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">
                  ${(m.totalVolume ?? 0).toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    data-testid={`link-merchant-${m.id}`}
                    onClick={() => setLocation(`/merchants/${m.id}`)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ id: m.id })}
                    data-testid={`button-delete-merchant-${m.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} data-testid="button-next">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
