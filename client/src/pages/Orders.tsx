import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, LockKeyhole, PackageCheck } from "lucide-react";
import { Link } from "wouter";
import { formatPrice } from "@/components/ProductCard";

export default function Orders() {
  const { isAuthenticated, loading } = useAuth();
  const ordersQuery = trpc.orders.listMine.useQuery(undefined, { enabled: isAuthenticated });

  return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-10 sm:py-14">
    <p className="text-xs font-semibold tracking-[0.15em] text-primary">PRIVATE ORDER SPACE</p>
    <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.055em] sm:text-5xl">我的模拟订单</h1>
    <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">每笔订单仅对所属登录账户可见。这里不处理真实支付，也不展示其他用户的订单信息。</p>
    {!loading && !isAuthenticated ? <section className="mt-9 max-w-2xl rounded-[1.75rem] border border-border bg-card p-7 sm:p-9"><LockKeyhole className="size-6 text-primary" /><h2 className="mt-5 font-display text-2xl font-bold tracking-[-0.04em]">登录后查看你的订单空间</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">登录身份是订单隔离的唯一依据；请先完成安全登录后继续。</p><Button className="mt-6 rounded-xl" onClick={() => startLogin()}>前往登录</Button></section> : null}
    {isAuthenticated && ordersQuery.isLoading ? <div className="mt-9 h-48 animate-pulse rounded-[1.75rem] bg-secondary" /> : null}
    {isAuthenticated && !ordersQuery.isLoading && (ordersQuery.data?.length ?? 0) === 0 ? <section className="mt-9 rounded-[1.75rem] border border-dashed border-border bg-secondary/30 p-10 text-center"><PackageCheck className="mx-auto size-7 text-primary" /><h2 className="mt-4 font-display text-2xl font-bold">还没有模拟订单</h2><p className="mt-2 text-sm text-muted-foreground">从商品详情页创建第一笔演示订单，体验完整的权限隔离流程。</p><Link href="/goods" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">去发现商品 <ArrowRight className="size-4" /></Link></section> : null}
    {isAuthenticated && (ordersQuery.data?.length ?? 0) > 0 ? <div className="mt-9 space-y-4">{ordersQuery.data?.map(order => <Link key={order.id} href={`/orders/${order.id}`} className="group block rounded-[1.5rem] border border-border bg-card p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-24px_rgba(45,33,60,0.4)]"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">{order.orderCode}</p><h2 className="mt-2 font-display text-xl font-bold">{order.items[0]?.titleSnapshot ?? "演示商品"}</h2><p className="mt-1 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString("zh-CN")}</p></div><div className="flex items-center justify-between gap-5 sm:justify-end"><p className="font-mono text-xl font-bold text-primary">{formatPrice(order.totalCents)}</p><ArrowRight className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" /></div></div></Link>)}</div> : null}
  </main></div>;
}
