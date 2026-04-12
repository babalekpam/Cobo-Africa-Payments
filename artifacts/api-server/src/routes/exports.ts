import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, transactionsTable, usersTable } from "@workspace/db";
import { requireAuthOrQueryToken, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

router.get("/exports/transactions.csv", requireAuthOrQueryToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  let txs = await db.select().from(transactionsTable).where(eq(transactionsTable.customerId, req.user!.id)).orderBy(desc(transactionsTable.createdAt));

  const { from, to, type, status } = req.query as Record<string, string>;
  if (type) txs = txs.filter(t => t.type === type);
  if (status) txs = txs.filter(t => t.status === status);
  if (from) txs = txs.filter(t => t.createdAt.toISOString() >= from);
  if (to) txs = txs.filter(t => t.createdAt.toISOString() <= to + "T23:59:59");

  const cols = ["Date", "Reference", "Type", "Status", "Amount", "Currency", "Description", "Payment Method"];
  const rows = txs.map(t => [
    t.createdAt.toISOString().replace("T", " ").slice(0, 19),
    t.reference || "",
    t.type || "",
    t.status || "",
    Number(t.amount || 0).toFixed(2),
    t.currency || "",
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.paymentMethod || "",
  ]);
  const csv = [cols.join(","), ...rows.map(r => r.join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="cobo-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("\uFEFF" + csv);
});

router.get("/exports/transactions.json", requireAuthOrQueryToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const txs = await db.select().from(transactionsTable).where(eq(transactionsTable.customerId, req.user!.id)).orderBy(desc(transactionsTable.createdAt));
  res.setHeader("Content-Disposition", `attachment; filename="cobo-transactions-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ exported_at: new Date().toISOString(), account: req.user!.email, count: txs.length, transactions: txs });
});

router.get("/exports/receipt/:txId", requireAuthOrQueryToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const txId = parseInt(req.params.txId);
  const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, txId));
  if (!tx || tx.customerId !== req.user!.id) { res.status(404).json({ success: false, message: "Transaction not found" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const isIn = tx.type === "receive" || tx.type === "deposit";
  const amt = Number(tx.amount || 0);
  const safeRef = escapeHtml(tx.reference || "");
  const safeDesc = escapeHtml(tx.description || "");
  const safeType = escapeHtml(tx.type || "");
  const safeStatus = escapeHtml(tx.status || "");
  const safeCurrency = escapeHtml(tx.currency || "");
  const safeEmail = escapeHtml(user?.email || req.user!.email);
  const safeName = escapeHtml(user?.businessName || ((user?.firstName || "") + " " + (user?.lastName || "")));
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${safeRef || tx.id}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#FAF7F2;padding:40px 20px;color:#2C2416}.card{background:#fff;border:2px solid #C8921A;border-radius:14px;padding:44px;max-width:520px;margin:0 auto}.logo{font-size:24px;font-weight:700;color:#C8921A;margin-bottom:4px}.sub{font-size:9px;color:#9A8F75;letter-spacing:4px;margin-bottom:28px}.amount{font-size:44px;font-weight:700;color:${isIn ? "#157a40" : "#2C2416"};letter-spacing:-2px;margin:16px 0 4px}.cur{font-size:15px;color:#9A8F75;margin-bottom:8px}.badge{display:inline-block;padding:4px 14px;border-radius:99px;font-size:12px;font-weight:600;background:${safeStatus === "completed" || safeStatus === "success" ? "#edf7f2" : safeStatus === "pending" ? "#fef9ec" : "#fef2f2"};color:${safeStatus === "completed" || safeStatus === "success" ? "#157a40" : safeStatus === "pending" ? "#C8921A" : "#b02020"}}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F5F0E8;font-size:14px;gap:16px}.lbl{color:#9A8F75;flex-shrink:0}.val{text-align:right;font-weight:500;word-break:break-all}.footer{text-align:center;margin-top:28px;padding-top:18px;border-top:1px solid #F5F0E8;font-size:11px;color:#9A8F75;line-height:2}@media print{body{background:#fff;padding:20px}}</style>
</head><body><div class="card">
<div class="logo">COBO</div><div class="sub">AFRICA PAYMENTS &middot; OFFICIAL RECEIPT</div>
<div class="amount">${isIn ? "+" : "&minus;"}${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
<div class="cur">${safeCurrency} &nbsp;&middot;&nbsp; <span class="badge">${safeStatus}</span></div>
<div style="height:1px;background:#F5F0E8;margin:18px 0"></div>
<div class="row"><span class="lbl">Date</span><span class="val">${escapeHtml(tx.createdAt.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" } as any))}</span></div>
<div class="row"><span class="lbl">Transaction ID</span><span class="val" style="font-family:monospace;font-size:11px">${tx.id}</span></div>
<div class="row"><span class="lbl">Reference</span><span class="val" style="font-family:monospace;font-size:11px">${safeRef || "&mdash;"}</span></div>
<div class="row"><span class="lbl">Type</span><span class="val">${safeType}</span></div>
${safeDesc ? `<div class="row"><span class="lbl">Description</span><span class="val">${safeDesc}</span></div>` : ""}
<div class="row" style="border:none"><span class="lbl">Amount</span><span class="val" style="color:#C8921A;font-size:16px">${safeCurrency} ${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
<div class="footer">${safeEmail}<br>${safeName}<br><strong>COBO Payment Platform &middot; cobo.africa</strong><br>Generated: ${escapeHtml(new Date().toLocaleString())}</div>
</div><script>window.addEventListener('load',()=>window.print())</script></body></html>`;
  res.setHeader("Content-Type", "text/html;charset=utf-8");
  res.send(html);
});

export default router;
