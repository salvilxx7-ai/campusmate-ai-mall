import { formatPrice, type CatalogProduct } from "@/components/ProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";

const conditionLabels = { excellent: "近全新", good: "成色良好", fair: "正常使用痕迹" };

export default function ProductDetail() {
  const [, params] = useRoute("/goods/:id");
  const [, setLocation] = useLocation();
  const productId = Number(params?.id);
  const { isAuthenticated } = useAuth();
  const productQuery = trpc.catalog.get.useQuery({ productId }, { enabled: Number.isInteger(productId) && productId > 0 });
  const checkout = trpc.orders.create.useMutation({
    onSuccess: order => {
      toast.success("模拟订单已创建", { description: `订单号 ${order?.orderCode ?? "已生成"}` });
      if (order) setLocation(`/orders/${order.id}`);
    },
    onError: error => toast.error("暂时无法创建订单", { description: error.message }),
  });
  const data = productQuery.data as CatalogProduct | undefined;

  if (productQuery.isLoading) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-12"><div className="h-[32rem] animate-pulse rounded-[2rem] bg-secondary" /></main></div>;
  if (!data) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16 text-center"><h1 className="font-display text-3xl font-bold">没有找到这件商品</h1><Link href="/goods" className="mt-5 inline-block text-primary hover:underline">返回商品列表</Link></main></div>;

  const image = data.images[0];
  const disabled = data.product.status !== "active" || checkout.isPending;
  const handleCheckout = () => {
    if (!isAuthenticated) return startLogin();
    checkout.mutate({ productId: data.product.id });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container py-8 sm:py-12">
        <Link href="/goods" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> 返回商品列表</Link>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div className="overflow-hidden rounded-[2rem] border border-border bg-secondary"><div className="aspect-[4/3]">{image ? <img src={image.url} alt={image.altText} className="size-full object-cover" /> : null}</div></div>
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">{data.category.name}</span><span className="inline-flex items-center gap-1 text-accent-foreground"><CheckCircle2 className="size-3.5 text-accent" /> {conditionLabels[data.product.condition]}</span></div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-0.055em] sm:text-5xl">{data.product.title}</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">{data.product.description}</p>
            <div className="mt-8 border-y border-border py-5"><p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">演示价格</p><p className="mt-1 font-mono text-4xl font-bold tracking-[-0.06em] text-primary">{formatPrice(data.product.priceCents)}</p><p className="mt-2 text-sm text-muted-foreground">{data.product.sellerLabel} · 仅作演示，不含真实支付。</p></div>
            <Button size="lg" onClick={handleCheckout} disabled={disabled} className="mt-7 h-12 rounded-xl text-base">{checkout.isPending ? "正在创建订单…" : data.product.status === "active" ? "创建模拟订单" : "该商品暂不可下单"}<PackageCheck className="ml-2 size-4" /></Button>
            <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-secondary/35 p-4 text-sm text-muted-foreground"><p className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /> 下单前需要登录，订单只会写入你的演示账户。</p><p className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> 订单详情由服务端核验所有权；越权访问会被拒绝并留存审计记录。</p></div>
          </div>
        </div>
      </main>
    </div>
  );
}
