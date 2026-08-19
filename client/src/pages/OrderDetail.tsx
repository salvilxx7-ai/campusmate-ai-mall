import { formatPrice } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = Number(params?.id);
  const { isAuthenticated } = useAuth();
  const query = trpc.orders.getMine.useQuery({ orderId: id }, { enabled: isAuthenticated && Number.isInteger(id) && id > 0, retry: false });
  const error = query.error?.data?.code === "FORBIDDEN";

  return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-8 sm:py-12"><Link href="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> 返回订单列表</Link>
    {!isAuthenticated ? <div className="mt-8 rounded-[1.75rem] border border-border bg-card p-8"><LockKeyhole className="size-6 text-primary" /><h1 className="mt-4 font-display text-3xl font-bold">请先登录</h1><p className="mt-2 text-sm text-muted-foreground">订单详情不会向未登录访客展示。</p></div> : null}
    {isAuthenticated && query.isLoading ? <div className="mt-8 h-64 animate-pulse rounded-[1.75rem] bg-secondary" /> : null}
    {isAuthenticated && query.error ? <div className="mt-8 max-w-2xl rounded-[1.75rem] border border-destructive/30 bg-card p-8"><LockKeyhole className="size-6 text-destructive" /><h1 className="mt-4 font-display text-3xl font-bold">{error ? "访问已被拒绝" : "订单不可用"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error ? "你只能查看自己的模拟订单。该次越权请求已被服务端拒绝并写入安全审计日志。" : query.error.message}</p><Link href="/orders"><Button variant="outline" className="mt-6 rounded-xl">回到我的订单</Button></Link></div> : null}
    {query.data ? <section className="mt-8 max-w-3xl overflow-hidden rounded-[1.75rem] border border-border bg-card"><div className="border-b border-border bg-primary px-6 py-7 text-primary-foreground sm:px-8"><p className="text-xs font-semibold tracking-[0.15em] text-[#d8c8e7]">SIMULATED ORDER · PRIVATE</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.045em]">{query.data.orderCode}</h1><p className="mt-2 text-sm text-[#eadff1]">创建于 {new Date(query.data.createdAt).toLocaleString("zh-CN")}</p></div><div className="p-6 sm:p-8"><div className="space-y-4">{query.data.items.map(item => <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-secondary/55 p-4"><div><p className="font-medium text-foreground">{item.titleSnapshot}</p><p className="mt-1 text-xs text-muted-foreground">数量 {item.quantity} · 下单时商品快照</p></div><p className="font-mono font-bold text-primary">{formatPrice(item.priceCentsSnapshot * item.quantity)}</p></div>)}</div><div className="mt-6 flex items-end justify-between border-t border-border pt-5"><div><p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">订单状态</p><p className="mt-1 font-medium text-foreground">已创建（演示）</p></div><p className="font-mono text-2xl font-bold text-primary">{formatPrice(query.data.totalCents)}</p></div><div className="mt-7 flex gap-3 rounded-xl border border-border bg-secondary/35 p-4 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> 本页的订单数据由服务端按当前登录身份查询。AI 客服中的订单工具也将使用同一所有权校验与审计机制。</div></div></section> : null}
  </main></div>;
}
