import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ImagePlus, Loader2, ShieldCheck, UploadCloud, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type UploadImage = { name: string; dataUrl: string };

function readFile(file: File) {
  return new Promise<UploadImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取图片：${file.name}`));
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  });
}

export default function PublishItem() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const categories = trpc.catalog.categories.useQuery();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState({ categoryId: "", title: "", description: "", price: "", condition: "good" as "excellent" | "good" | "fair" });
  const [images, setImages] = useState<UploadImage[]>([]);
  const publish = trpc.catalog.publish.useMutation({
    onSuccess: () => {
      toast.success("闲置物品已提交审核", { description: "图片已由服务端保存，审核通过前不会出现在公开商城。" });
      void utils.profile.mine.invalidate();
      setLocation("/profile");
    },
    onError: error => toast.error("提交失败", { description: error.message }),
  });

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><section className="max-w-xl rounded-[1.5rem] border border-border bg-card p-8"><UploadCloud className="size-7 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold">登录后发布闲置物品</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">发布记录、图片和审核状态都只归当前账户管理。请先完成普通用户注册或登录；授权完成后会进入个人中心，再继续发布。</p><Button className="mt-6 rounded-xl" onClick={() => startLogin({ returnTo: "/profile" })}>注册或登录后发布</Button></section></main></div>;

  const selectImages = async (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, 3);
    if (picked.length !== files.length) toast.message("最多上传 3 张图片", { description: "已仅选择前 3 张。" });
    if (picked.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return toast.error("图片格式不支持", { description: "仅支持 JPEG、PNG 或 WebP。" });
    if (picked.some(file => file.size > 2 * 1024 * 1024)) return toast.error("图片过大", { description: "单张图片不得超过 2MB。" });
    try { setImages(await Promise.all(picked.map(readFile))); } catch (error) { toast.error("图片读取失败", { description: error instanceof Error ? error.message : "请重新选择图片" }); }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const priceCents = Math.round(Number(draft.price) * 100);
    if (!draft.categoryId || !draft.title.trim() || !draft.description.trim() || images.length === 0 || !Number.isFinite(priceCents)) return toast.error("请补全发布信息", { description: "分类、标题、价格、详细描述和至少一张图片均为必填项。" });
    publish.mutate({ categoryId: Number(draft.categoryId), title: draft.title, description: draft.description, priceCents, condition: draft.condition, images });
  };

  return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-9 sm:py-12"><Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="size-4" />返回个人中心</Link><section className="mt-5 grid gap-7 lg:grid-cols-[0.72fr_1.28fr]"><aside className="rounded-[1.75rem] bg-primary p-7 text-primary-foreground sm:p-9"><p className="text-xs font-semibold tracking-[0.15em] text-[#d8c8e7]">POST AN ITEM</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em]">让闲置物品继续流转。</h1><p className="mt-5 text-sm leading-7 text-[#eadff1]">填写真实且必要的商品信息即可提交。本项目中的商品、图片和审核均为作品集演示数据，不包含支付或真实交易。</p><div className="mt-8 rounded-2xl border border-white/15 bg-white/8 p-5"><ShieldCheck className="size-5" /><p className="mt-3 font-semibold">发布与审核边界</p><p className="mt-2 text-sm leading-6 text-[#eadff1]">提交后状态为“等待审核”，不会进入公开商品目录。图片由服务端写入对象存储，发布归属和审核状态均以当前登录会话为准。</p></div></aside><section className="rounded-[1.75rem] border border-border bg-card p-6 sm:p-9"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">LISTING FORM</p><h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">发布闲置物品</h2><p className="mt-2 text-sm text-muted-foreground">图片最多 3 张，每张不超过 2MB，支持 JPEG、PNG、WebP。</p></div><form className="mt-7 grid gap-5" onSubmit={submit}><div className="grid gap-5 sm:grid-cols-2"><div><Label>商品分类</Label><Select value={draft.categoryId} onValueChange={categoryId => setDraft(current => ({ ...current, categoryId }))}><SelectTrigger className="mt-2"><SelectValue placeholder="选择分类" /></SelectTrigger><SelectContent>{categories.data?.map(category => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="listing-condition">成色</Label><Select value={draft.condition} onValueChange={condition => setDraft(current => ({ ...current, condition: condition as typeof draft.condition }))}><SelectTrigger id="listing-condition" className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="excellent">近乎全新</SelectItem><SelectItem value="good">成色良好</SelectItem><SelectItem value="fair">正常使用痕迹</SelectItem></SelectContent></Select></div></div><div><Label htmlFor="listing-title">商品标题</Label><Input id="listing-title" className="mt-2" maxLength={160} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="例如：数据结构教材与学习笔记" /></div><div><Label htmlFor="listing-price">价格（元）</Label><Input id="listing-price" className="mt-2" inputMode="decimal" value={draft.price} onChange={event => setDraft(current => ({ ...current, price: event.target.value }))} placeholder="例如：35.00" /></div><div><Label htmlFor="listing-description">详细描述</Label><Textarea id="listing-description" className="mt-2 min-h-36 resize-y" maxLength={2000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="说明购入时间、使用情况、包含配件和你希望买家注意的事项。" /><p className="mt-1 text-right text-xs text-muted-foreground">{draft.description.length}/2000</p></div><div><Label htmlFor="listing-images">商品图片</Label><label htmlFor="listing-images" className="mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-secondary/25 p-5 text-center transition-colors hover:bg-secondary/45"><ImagePlus className="size-6 text-primary" /><p className="mt-3 text-sm font-semibold">选择 1 至 3 张图片</p><p className="mt-1 text-xs text-muted-foreground">JPEG、PNG 或 WebP；每张最大 2MB</p><input id="listing-images" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => void selectImages(event.target.files)} /></label>{images.length > 0 ? <div className="mt-3 grid grid-cols-3 gap-3">{images.map((image, index) => <div key={image.name + index} className="group relative overflow-hidden rounded-xl border border-border"><img src={image.dataUrl} alt={`待上传图片 ${index + 1}`} className="aspect-square w-full object-cover" /><button type="button" aria-label={`移除图片 ${index + 1}`} onClick={() => setImages(current => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-background/90 text-foreground opacity-0 transition-opacity group-hover:opacity-100"><X className="size-4" /></button></div>)}</div> : null}</div><div className="flex flex-wrap items-center gap-3 pt-2"><Button type="submit" className="rounded-xl" disabled={publish.isPending || categories.isLoading}>{publish.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />正在提交…</> : "提交审核"}</Button><p className="text-xs text-muted-foreground">提交即表示该商品属于演示数据，并接受管理员审核。</p></div></form></section></section></main></div>;
}
