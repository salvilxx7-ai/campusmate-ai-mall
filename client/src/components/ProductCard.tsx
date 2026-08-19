import { ArrowUpRight, Bookmark, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export type CatalogProduct = {
  product: {
    id: number;
    title: string;
    priceCents: number;
    condition: "excellent" | "good" | "fair";
    sellerLabel: string;
    status: "active" | "reserved" | "archived";
    description: string;
  };
  category: { name: string; slug: string };
  images: Array<{ url: string; altText: string }>;
};

const conditionLabels = { excellent: "近全新", good: "成色良好", fair: "正常使用痕迹" };

export function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(priceCents / 100);
}

export function ProductCard({ item }: { item: CatalogProduct }) {
  const image = item.images[0];
  return (
    <article className="group overflow-hidden rounded-[1.35rem] border border-border/90 bg-card transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_18px_35px_-24px_rgba(45,33,60,0.45)]">
      <Link href={`/goods/${item.product.id}`} className="block focus-visible:outline-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {image ? (
            <img src={image.url} alt={image.altText} className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.045]" />
          ) : null}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-[0.68rem] font-semibold text-foreground shadow-sm backdrop-blur">{item.category.name}</span>
            <span className="grid size-8 place-items-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur" aria-label="演示商品">
              <Bookmark className="size-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-1 font-display text-lg font-bold tracking-[-0.025em] text-foreground">{item.product.title}</h3>
            <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </div>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{item.product.description}</p>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
            <div>
              <p className="font-mono text-xl font-bold tracking-[-0.05em] text-primary">{formatPrice(item.product.priceCents)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.product.sellerLabel}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent-foreground">
              <CheckCircle2 className="size-3.5 text-accent" aria-hidden="true" />
              {conditionLabels[item.product.condition]}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
