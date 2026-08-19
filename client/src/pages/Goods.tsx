import { ProductCard, type CatalogProduct } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export default function Goods() {
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [query, setQuery] = useState(initial.get("q") ?? "");
  const [categorySlug, setCategorySlug] = useState(initial.get("category") ?? "");
  const { data: categories = [] } = trpc.catalog.categories.useQuery();
  const { data: items = [], isLoading } = trpc.catalog.list.useQuery({ query: query || undefined, categorySlug: categorySlug || undefined });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.15em] text-primary">MARKETPLACE DIRECTORY</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.055em] sm:text-5xl">找到下一件，刚好适合你的好物。</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">所有列表均为演示商品。使用搜索与分类筛选体验公开发现流程；下单仍需要登录。</p>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="输入商品名或描述关键词" className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" aria-label="搜索商品" />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="按分类筛选">
              <button type="button" onClick={() => setCategorySlug("")} className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${!categorySlug ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}>全部</button>
              {categories.map(category => <button type="button" key={category.id} onClick={() => setCategorySlug(category.slug)} className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${categorySlug === category.slug ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}>{category.name}</button>)}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" /> 当前仅展示可下单的演示商品</div>
        </div>

        {isLoading ? <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"><div className="h-80 animate-pulse rounded-[1.35rem] bg-secondary" /><div className="h-80 animate-pulse rounded-[1.35rem] bg-secondary" /><div className="h-80 animate-pulse rounded-[1.35rem] bg-secondary" /></div> : null}
        {!isLoading && items.length === 0 ? <div className="mt-8 rounded-[1.5rem] border border-dashed border-border bg-secondary/30 p-10 text-center"><p className="font-display text-xl font-bold">暂时没有匹配的商品</p><p className="mt-2 text-sm text-muted-foreground">换一个关键词，或清除分类筛选再试试。</p></div> : null}
        {!isLoading && items.length > 0 ? <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{(items as CatalogProduct[]).map(item => <ProductCard key={item.product.id} item={item} />)}</div> : null}
      </main>
    </div>
  );
}
