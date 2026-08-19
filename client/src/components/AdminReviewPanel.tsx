import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { CheckCheck, CircleX, Filter, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatPrice, type CatalogProduct } from "./ProductCard";

const reviewStatuses = [
  { value: "all", label: "全部" },
  { value: "pending_review", label: "待审核" },
  { value: "active", label: "已上架" },
  { value: "rejected", label: "已拒绝" },
  { value: "reserved", label: "已预留" },
  { value: "archived", label: "已下架" },
] as const;

const statusLabel = { pending_review: "待审核", active: "已上架", reserved: "已预留", archived: "已下架", rejected: "已拒绝" } as const;
const statusTone = { pending_review: "bg-violet-50 text-violet-700", active: "bg-emerald-50 text-emerald-700", reserved: "bg-amber-50 text-amber-700", archived: "bg-muted text-muted-foreground", rejected: "bg-red-50 text-red-700" } as const;

export function AdminReviewPanel() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<(typeof reviewStatuses)[number]["value"]>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reviewReason, setReviewReason] = useState("");
  const products = trpc.admin.products.useQuery(filter === "all" ? undefined : { status: filter });
  const items = (products.data ?? []) as CatalogProduct[];
  const pendingIds = useMemo(() => items.filter(item => item.product.status === "pending_review").map(item => item.product.id), [items]);
  const selectedPendingIds = selectedIds.filter(id => pendingIds.includes(id));
  const refresh = async () => {
    setSelectedIds([]);
    await utils.admin.products.invalidate();
    await utils.catalog.list.invalidate();
    await utils.catalog.featured.invalidate();
    await utils.profile.mine.invalidate();
  };
  const review = trpc.admin.batchReviewProducts.useMutation({
    onSuccess: async result => {
      const summary = [`通过 ${result.approvedCount} 件`, `拒绝 ${result.rejectedCount} 件`];
      if (result.skippedCount) summary.push(`跳过 ${result.skippedCount} 件`);
      toast.success("批量审核已完成", { description: `${summary.join("，")}。每件商品的结果均已写入审计记录。` });
      setReviewReason("");
      await refresh();
    },
    onError: error => toast.error("批量审核失败", { description: error.message }),
  });
  const toggle = (id: number, checked: boolean) => setSelectedIds(current => checked ? Array.from(new Set([...current, id])) : current.filter(item => item !== id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? pendingIds : []);
  const submit = (action: "approve" | "reject") => {
    if (selectedPendingIds.length === 0) return toast.error("请先选择待审核商品");
    if (action === "reject" && reviewReason.trim().length < 2) return toast.error("请填写至少 2 个字符的拒绝原因");
    const label = action === "approve" ? "批量通过" : "批量拒绝";
    if (!window.confirm(`确认${label}所选 ${selectedPendingIds.length} 件商品吗？该操作会逐项写入安全审计记录。`)) return;
    review.mutate({ productIds: selectedPendingIds, action, ...(action === "reject" ? { reviewReason: reviewReason.trim() } : {}) });
  };

  return <section id="review" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">LISTING REVIEW QUEUE</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">商品审核队列</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">仅“待审核”商品可被选择。服务端会在事务内逐条锁定、复核状态并记录结果，因此页面过期或并发操作不会将其他状态误审为上架或拒绝。</p></div><Badge variant="secondary" className="h-fit font-normal">当前筛选 {items.length} 件</Badge></div><div className="mt-6 flex flex-wrap gap-2" aria-label="审核状态筛选"><span className="inline-flex items-center gap-1 self-center pr-1 text-xs font-semibold text-muted-foreground"><Filter className="size-3.5" />状态</span>{reviewStatuses.map(status => <Button key={status.value} type="button" size="sm" variant={filter === status.value ? "default" : "outline"} className="rounded-full" onClick={() => { setFilter(status.value); setSelectedIds([]); }}>{status.label}</Button>)}</div><div className="mt-5 grid gap-3 rounded-xl border border-primary/15 bg-secondary/20 p-4 lg:grid-cols-[1fr_auto_auto]"><Input value={reviewReason} maxLength={255} onChange={event => setReviewReason(event.target.value)} placeholder="批量拒绝原因（拒绝时必填，会展示给发布者）" aria-label="批量拒绝原因" /><Button className="rounded-xl" disabled={review.isPending || selectedPendingIds.length === 0} onClick={() => submit("approve")}>{review.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCheck className="mr-2 size-4" />}批量通过（{selectedPendingIds.length}）</Button><Button variant="outline" className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-700" disabled={review.isPending || selectedPendingIds.length === 0 || reviewReason.trim().length < 2} onClick={() => submit("reject")}><CircleX className="mr-2 size-4" />批量拒绝</Button></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="w-12 px-4 py-3"><Checkbox aria-label="选择所有当前待审核商品" checked={pendingIds.length > 0 && selectedPendingIds.length === pendingIds.length} onCheckedChange={checked => toggleAll(checked === true)} /></th><th className="px-4 py-3">商品</th><th className="px-4 py-3">发布者</th><th className="px-4 py-3">价格</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">审核说明</th></tr></thead><tbody>{items.map(item => { const selectable = item.product.status === "pending_review"; return <tr key={item.product.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4"><Checkbox aria-label={`选择 ${item.product.title}`} disabled={!selectable} checked={selectedPendingIds.includes(item.product.id)} onCheckedChange={checked => toggle(item.product.id, checked === true)} /></td><td className="px-4 py-4"><p className="font-medium text-foreground">{item.product.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.category.name} · {item.product.condition === "excellent" ? "近乎全新" : item.product.condition === "good" ? "成色良好" : "正常使用痕迹"}</p></td><td className="px-4 py-4 text-muted-foreground">{item.product.sellerLabel}</td><td className="px-4 py-4 font-mono font-semibold">{formatPrice(item.product.priceCents)}</td><td className="px-4 py-4"><Badge className={`border-0 ${statusTone[item.product.status]}`}>{statusLabel[item.product.status]}</Badge></td><td className="max-w-52 px-4 py-4 text-xs leading-5 text-muted-foreground">{item.product.reviewReason ?? "—"}</td></tr>; })}</tbody></table></div>{products.isLoading ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-secondary" /> : null}{!products.isLoading && items.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-center text-sm text-muted-foreground"><ShieldCheck className="mx-auto mb-2 size-5 text-primary" />当前筛选条件下没有商品。</div> : null}</section>;
}
