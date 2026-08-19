import { ProductCard, type CatalogProduct } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Check, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [keyword, setKeyword] = useState("");
  const { data: categories = [] } = trpc.catalog.categories.useQuery();
  const { data: featured = [], isLoading } = trpc.catalog.featured.useQuery();

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    setLocation(`/goods${params.size ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border/80">
          <div className="paper-grid absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="container relative grid gap-12 pb-16 pt-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-end lg:pb-24 lg:pt-24">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="size-1.5 rounded-full bg-accent" />
                所有商品均为明确标注的演示数据
              </div>
              <p className="text-sm font-semibold tracking-[0.14em] text-primary">CAMPUS RESALE, CAREFULLY CURATED</p>
              <h1 className="mt-4 max-w-3xl font-display text-[clamp(3rem,7vw,6.4rem)] font-bold leading-[0.91] tracking-[-0.065em] text-foreground">
                让好物，
                <span className="block text-primary">在校园里继续发光。</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                从一盏阅读灯到一套复习资料，CampusMate 让每件仍有价值的物品被认真看见。浏览无需登录，下单与订单服务始终由安全边界保护。
              </p>
              <form className="mt-8 flex max-w-xl gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_14px_38px_-25px_rgba(45,33,60,0.35)]" onSubmit={submitSearch}>
                <Search className="ml-2 mt-2.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={keyword}
                  onChange={event => setKeyword(event.target.value)}
                  className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  placeholder="搜一搜相机、教材、收纳箱…"
                  aria-label="搜索校园好物"
                />
                <Button type="submit" className="rounded-xl px-4 sm:px-5">开始发现</Button>
              </form>
            </div>

            <aside className="relative mx-auto w-full max-w-md rounded-[2rem] border border-primary/15 bg-primary p-6 text-primary-foreground shadow-[0_30px_70px_-35px_rgba(45,33,60,0.85)] sm:p-8">
              <div className="absolute -right-10 -top-12 size-40 rounded-full border border-white/20" aria-hidden="true" />
              <div className="relative">
                <Sparkles className="size-6 text-[#cbb7da]" aria-hidden="true" />
                <p className="mt-10 text-sm font-semibold tracking-[0.12em] text-[#d8c8e7]">安心交易，不只是一句口号</p>
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-0.04em]">每个订单，都只属于它的主人。</h2>
                <p className="mt-4 text-sm leading-6 text-[#eadff1]">模拟订单数据按登录身份严格隔离；越权访问会被拒绝并记录，后续 AI 客服也只能查询“我的订单”。</p>
                <Link href="/orders" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline">
                  查看我的订单 <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="container py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] text-primary">EXPLORE BY PURPOSE</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.045em]">从你的校园日常开始</h2>
            </div>
            <Link href="/goods" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              查看全部商品 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map(category => (
              <Link key={category.id} href={`/goods?category=${category.slug}`} className="group rounded-2xl border border-border bg-card p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40">
                <span className="font-display text-lg font-bold tracking-[-0.03em]">{category.name}</span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">{category.description}</span>
                <ArrowRight className="mt-4 size-4 text-primary transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/45 py-12 sm:py-16">
          <div className="container">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.15em] text-primary">SELECTED FOR CAMPUS LIFE</p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.045em]">正在被好好使用的物品</h2>
              </div>
              <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block">演示目录</span>
            </div>
            {isLoading ? <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"><div className="h-80 animate-pulse rounded-[1.35rem] bg-card" /><div className="h-80 animate-pulse rounded-[1.35rem] bg-card" /><div className="h-80 animate-pulse rounded-[1.35rem] bg-card" /></div> : null}
            {!isLoading ? <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{(featured as CatalogProduct[]).map(item => <ProductCard key={item.product.id} item={item} />)}</div> : null}
          </div>
        </section>

        <section className="container py-14 sm:py-20">
          <div className="grid gap-6 rounded-[2rem] border border-border bg-card p-6 md:grid-cols-[1fr_auto] md:items-center md:p-9">
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="size-5" /></span>
              <div>
                <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">把安全讲清楚，才是更好的体验。</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">这是一套面向项目演示的模拟交易流程。它不处理真实支付；订单访问、后续客服工具与后台权限都会在服务端重新校验。</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-accent" /> 登录后才能下单</span><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-accent" /> 订单按身份隔离</span></div>
          </div>
        </section>
      </main>
    </div>
  );
}
