import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowLeft, CheckCircle2, FileEdit, ImagePlus, Loader2, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type UploadImage = { name: string; dataUrl: string };

const statusLabel = { pending_review: "等待审核", active: "展示中", reserved: "已被预留", archived: "已撤回", rejected: "审核未通过" } as const;
const statusTone = { pending_review: "bg-violet-50 text-violet-700", active: "bg-emerald-50 text-emerald-700", reserved: "bg-amber-50 text-amber-700", archived: "bg-muted text-muted-foreground", rejected: "bg-red-50 text-red-700" } as const;
const conditionLabel = { excellent: "近乎全新", good: "成色良好", fair: "正常使用痕迹" } as const;

function formatPrice(cents: number) { return `¥${(cents / 100).toFixed(2)}`; }

function readFile(file: File) {
  return new Promise<UploadImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });
}

export default function ListingManager() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const profile = trpc.profile.mine.useQuery(undefined, { enabled: Boolean(user) });
  const categories = trpc.catalog.categories.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ categoryId: "", title: "", description: "", price: "", condition: "good" as "excellent" | "good" | "fair" });
  const [newImages, setNewImages] = useState<UploadImage[]>([]);
  const listing = profile.data?.listings.find(item => item.product.id === editingId);

  useEffect(() => {
    if (!listing) return;
    setDraft({ categoryId: String(listing.product.categoryId), title: listing.product.title, description: listing.product.description, price: (listing.product.priceCents / 100).toFixed(2), condition: listing.product.condition });
    setNewImages([]);
  }, [listing]);

  const refresh = async () => { await utils.profile.mine.invalidate(); };
  const update = trpc.catalog.updateListing.useMutation({
    onSuccess: async () => { toast.success("商品已更新并重新进入审核", { description: "编辑后的商品不会立即公开展示。" }); setEditingId(null); await refresh(); },
    onError: error => toast.error("更新失败", { description: error.message }),
  });
  const withdraw = trpc.catalog.withdrawListing.useMutation({
    onSuccess: async () => { toast.success("商品已撤回"); await refresh(); },
    onError: error => toast.error("撤回失败", { description: error.message }),
  });
  const resubmit = trpc.catalog.resubmitListing.useMutation({
    onSuccess: async () => { toast.success("已重新提交审核", { description: "审核通过前不会出现在公开商城。" }); await refresh(); },
    onError: error => toast.error("提交失败", { description: error.message }),
  });

  const pickImages = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 3);
    if (selected.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return toast.error("图片格式不支持", { description: "仅支持 JPEG、PNG 或 WebP。" });
    if (selected.some(file => file.size > 2 * 1024 * 1024)) return toast.error("图片过大", { description: "单张图片不得超过 2MB。" });
    try { setNewImages(await Promise.all(selected.map(readFile))); } catch (error) { toast.error("图片读取失败", { description: error instanceof Error ? error.message : "请重新选择图片" }); }
  };

  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!listing) return;
    const priceCents = Math.round(Number(draft.price) * 100);
    if (!draft.categoryId || !draft.title.trim() || !draft.description.trim() || !Number.isFinite(priceCents)) return toast.error("请补全商品信息");
    update.mutate({ productId: listing.product.id, categoryId: Number(draft.categoryId), title: draft.title, description: draft.description, priceCents, condition: draft.condition, ...(newImages.length > 0 ? { images: newImages } : {}) });
  };

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><section className="max-w-xl rounded-[1.5rem] border border-border bg-card p-8"><ShieldCheck className="size-7 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold">登录后管理发布物品</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">编辑、撤回与重新提交都只对当前 OAuth 会话下的商品生效，服务端会再次核验发布归属。</p><Button className="mt-6 rounded-xl" onClick={() => startLogin({ returnTo: "/profile/listings" })}>注册或登录后管理</Button></section></main></div>;

  const listings = profile.data?.listings ?? [];
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-9 sm:py-12"><Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="size-4" />返回个人中心</Link><section className="mt-5 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(115deg,#321b49_0%,#4d2b62_58%,#6d4678_100%)] p-7 text-primary-foreground sm:p-9"><p className="text-xs font-semibold tracking-[0.15em] text-[#d8c8e7]">MY LISTING CONTROL</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] sm:text-5xl">我发布的物品。</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#eadff1]">编辑商品会使其重新进入审核；撤回后的商品可再次提交。已被预留的商品不允许修改或撤回，以避免影响已有模拟订单。</p></section><section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">OWNER-ONLY RECORDS</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">发布记录与审核状态</h2></div><Link href="/publish" className="inline-flex items-center gap-2 rounded-xl border border-primary/25 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary"><ImagePlus className="size-4" />发布新物品</Link></div>{profile.isLoading ? <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="h-48 animate-pulse rounded-2xl bg-secondary" /><div className="h-48 animate-pulse rounded-2xl bg-secondary" /></div> : listings.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/25 p-8 text-center"><ImagePlus className="mx-auto size-7 text-primary" /><h3 className="mt-4 font-display text-xl font-bold">还没有发布物品</h3><p className="mt-2 text-sm text-muted-foreground">从发布页提交一件演示闲置物品后，可以在这里持续管理。</p></div> : <div className="mt-6 grid gap-5 md:grid-cols-2">{listings.map(item => { const product = item.product; const editable = product.status !== "reserved"; const canResubmit = product.status === "rejected" || product.status === "archived"; return <article key={product.id} className="overflow-hidden rounded-[1.4rem] border border-border bg-card"><div className="grid grid-cols-[7.5rem_1fr] gap-4 p-5"><div className="overflow-hidden rounded-xl bg-secondary">{item.images[0] ? <img src={item.images[0].url} alt={item.images[0].altText} className="aspect-square h-full w-full object-cover" /> : <div className="grid aspect-square place-items-center"><ImagePlus className="size-5 text-primary" /></div>}</div><div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="line-clamp-2 font-display text-lg font-bold">{product.title}</h3><Badge className={`shrink-0 border-0 ${statusTone[product.status]}`}>{statusLabel[product.status]}</Badge></div><p className="mt-2 font-mono text-lg font-bold text-primary">{formatPrice(product.priceCents)}</p><p className="mt-1 text-xs text-muted-foreground">{item.category.name} · {conditionLabel[product.condition]}</p></div></div>{product.reviewReason ? <div className="mx-5 rounded-xl border border-red-100 bg-red-50/65 p-3 text-sm text-red-800"><span className="font-semibold">审核说明：</span>{product.reviewReason}</div> : null}<div className="mt-4 flex flex-wrap gap-2 border-t border-border bg-secondary/15 p-4"><Button size="sm" variant="outline" className="rounded-lg" disabled={!editable || update.isPending} onClick={() => setEditingId(product.id)}><FileEdit className="mr-1.5 size-3.5" />编辑</Button><Button size="sm" variant="outline" className="rounded-lg" disabled={!editable || product.status === "archived" || withdraw.isPending} onClick={() => { if (window.confirm(`确认撤回“${product.title}”？撤回后可再次提交审核。`)) withdraw.mutate({ productId: product.id }); }}><Archive className="mr-1.5 size-3.5" />撤回</Button>{canResubmit ? <Button size="sm" className="rounded-lg" disabled={resubmit.isPending} onClick={() => resubmit.mutate({ productId: product.id })}><RefreshCcw className="mr-1.5 size-3.5" />重新提交</Button> : null}{product.status === "reserved" ? <span className="self-center text-xs text-amber-700">预留中，暂不可更改</span> : null}</div></article>; })}</div>}</section></main><Dialog open={Boolean(editingId)} onOpenChange={open => { if (!open) setEditingId(null); }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="font-display text-2xl">编辑发布物品</DialogTitle><DialogDescription>提交编辑后，商品会回到“等待审核”，管理员审核通过前不会公开展示。若不选择新图片，将保留现有图片。</DialogDescription></DialogHeader>{listing ? <form className="mt-3 grid gap-4" onSubmit={submitEdit}><div className="grid gap-4 sm:grid-cols-2"><div><Label>商品分类</Label><Select value={draft.categoryId} onValueChange={categoryId => setDraft(current => ({ ...current, categoryId }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{categories.data?.map(category => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select></div><div><Label>成色</Label><Select value={draft.condition} onValueChange={condition => setDraft(current => ({ ...current, condition: condition as typeof draft.condition }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="excellent">近乎全新</SelectItem><SelectItem value="good">成色良好</SelectItem><SelectItem value="fair">正常使用痕迹</SelectItem></SelectContent></Select></div></div><div><Label htmlFor="managed-listing-title">商品标题</Label><Input id="managed-listing-title" className="mt-2" maxLength={160} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></div><div><Label htmlFor="managed-listing-price">价格（元）</Label><Input id="managed-listing-price" className="mt-2" inputMode="decimal" value={draft.price} onChange={event => setDraft(current => ({ ...current, price: event.target.value }))} /></div><div><Label htmlFor="managed-listing-description">详细描述</Label><Textarea id="managed-listing-description" className="mt-2 min-h-28 resize-y" maxLength={2000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></div><div><Label htmlFor="managed-listing-images">替换全部商品图片（可选）</Label><label htmlFor="managed-listing-images" className="mt-2 flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-primary/35 bg-secondary/20 p-4 text-center"><ImagePlus className="mr-2 size-4 text-primary" /><span className="text-sm font-medium">选择 1 至 3 张新图片</span><input id="managed-listing-images" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void pickImages(event.target.files)} /></label>{newImages.length > 0 ? <div className="mt-3 grid grid-cols-3 gap-3">{newImages.map((image, index) => <div key={`${image.name}-${index}`} className="group relative overflow-hidden rounded-xl border border-border"><img src={image.dataUrl} alt={`替换图片 ${index + 1}`} className="aspect-square w-full object-cover" /><button type="button" aria-label={`移除图片 ${index + 1}`} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => setNewImages(current => current.filter((_, imageIndex) => imageIndex !== index))}><X className="size-4" /></button></div>)}</div> : null}</div><div className="flex justify-end gap-3 pt-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingId(null)}>取消</Button><Button type="submit" className="rounded-xl" disabled={update.isPending || categories.isLoading}>{update.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />正在提交…</> : <><CheckCircle2 className="mr-2 size-4" />保存并提交审核</>}</Button></div></form> : null}</DialogContent></Dialog></div>;
}
