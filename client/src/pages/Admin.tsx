import { SiteHeader } from "@/components/SiteHeader";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Archive, BookOpen, Database, LockKeyhole, Package, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, type CatalogProduct } from "@/components/ProductCard";
import { useRef, useState } from "react";

const statusLabel = { active: "已上架", reserved: "已保留", archived: "已下架" };

function AdminContent() {
  const utils = trpc.useUtils();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"policy" | "after_sales" | "faq">("policy");
  const [publicSourceUrl, setPublicSourceUrl] = useState("");
  const products = trpc.admin.products.useQuery();
  const knowledgeDocuments = trpc.admin.knowledgeDocuments.useQuery();
  const seed = trpc.admin.seedDemoCatalog.useMutation({
    onSuccess: result => {
      toast.success(result.seeded ? "演示目录已初始化" : "演示目录已存在");
      void utils.admin.products.invalidate();
    },
    onError: error => toast.error("初始化失败", { description: error.message }),
  });
  const statusMutation = trpc.admin.updateProductStatus.useMutation({
    onSuccess: () => {
      toast.success("商品状态已更新");
      void utils.admin.products.invalidate();
      void utils.catalog.list.invalidate();
      void utils.catalog.featured.invalidate();
    },
    onError: error => toast.error("状态更新失败", { description: error.message }),
  });
  const seedKnowledge = trpc.admin.seedDemoKnowledgeBase.useMutation({
    onSuccess: result => {
      toast.success(result.seeded ? "演示知识库已初始化" : "演示知识库已存在");
      void utils.admin.knowledgeDocuments.invalidate();
    },
    onError: error => toast.error("知识库初始化失败", { description: error.message }),
  });
  const uploadKnowledge = trpc.admin.uploadKnowledgeDocument.useMutation({
    onSuccess: result => {
      if (result.vectorIndexStatus === "synced") toast.success("规则已同步至 Chroma", { description: `已生成 ${result.chunkCount} 个分块，客服可立即检索。` });
      else toast.warning("文档已保存，索引待重试", { description: "Chroma 暂未就绪；管理员可在下方卡片重新同步。" });
      void utils.admin.knowledgeDocuments.invalidate();
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      setPublicSourceUrl("");
    },
    onError: error => toast.error("文档上传失败", { description: error.message }),
  });
  const retryVectorSync = trpc.admin.retryKnowledgeVectorSync.useMutation({
    onSuccess: result => {
      toast.success("Chroma 同步完成", { description: `已索引 ${result.chunkCount} 个公开规则分块。` });
      void utils.admin.knowledgeDocuments.invalidate();
    },
    onError: error => toast.error("同步失败", { description: error.message }),
  });

  const handleKnowledgeFile = (file?: File) => {
    if (!file) return;
    if (!/\.(md|txt)$/i.test(file.name)) {
      toast.error("仅支持 .md 或 .txt 文档");
      return;
    }
    if (file.size > 100_000) {
      toast.error("演示版单个文档最多 100KB");
      return;
    }
    if (!publicSourceUrl.startsWith("https://")) {
      toast.error("请填写 HTTPS 格式的公开规则来源 URL");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result.split(",")[1] : undefined;
      if (!content) {
        toast.error("无法读取文档内容");
        return;
      }
      uploadKnowledge.mutate({ fileName: file.name, mimeType: file.name.endsWith(".md") ? "text/markdown" : "text/plain", sourceType: uploadType, publicSourceUrl, base64Content: content });
    };
    reader.readAsDataURL(file);
  };

  const items = (products.data ?? []) as CatalogProduct[];
  const activeCount = items.filter(item => item.product.status === "active").length;
  const reservedCount = items.filter(item => item.product.status === "reserved").length;

  return <div className="mx-auto max-w-6xl space-y-7 pb-10">
    <section className="overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground shadow-[0_22px_54px_-32px_rgba(45,33,60,0.85)] sm:p-9">
      <p className="text-xs font-semibold tracking-[0.15em] text-[#d8c8e7]">ADMINISTRATOR ONLY</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.055em]">CampusMate 管理台</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#eadff1]">所有操作均通过服务端 `adminProcedure` 校验。普通用户既看不到该入口，也无法通过直接请求绕过角色门槛。</p>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-border bg-card p-5"><Package className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">目录商品</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{items.length}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><ShieldCheck className="size-5 text-accent" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">可下单</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{activeCount}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><Archive className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">已保留</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{reservedCount}</p></div>
    </section>

    <section id="products" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">CATALOG CONTROL</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">演示商品管理</h2><p className="mt-2 text-sm text-muted-foreground">目录数据明确标注为演示内容；状态更新会被记录为安全审计事件。</p></div><Button variant="outline" className="rounded-xl" onClick={() => seed.mutate()} disabled={seed.isPending}><RefreshCw className={`mr-2 size-4 ${seed.isPending ? "animate-spin" : ""}`} />{seed.isPending ? "正在检查…" : "初始化演示目录"}</Button></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="px-4 py-3">商品</th><th className="px-4 py-3">分类</th><th className="px-4 py-3">价格</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody>{items.map(item => <tr key={item.product.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4 font-medium text-foreground">{item.product.title}</td><td className="px-4 py-4 text-muted-foreground">{item.category.name}</td><td className="px-4 py-4 font-mono font-semibold">{formatPrice(item.product.priceCents)}</td><td className="px-4 py-4"><Badge variant="secondary" className="font-normal">{statusLabel[item.product.status]}</Badge></td><td className="px-4 py-4 text-right">{item.product.status === "archived" ? <Button size="sm" className="rounded-lg" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ productId: item.product.id, status: "active" })}>重新上架</Button> : <Button size="sm" variant="outline" className="rounded-lg" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ productId: item.product.id, status: "archived" })}>下架</Button>}</td></tr>)}</tbody></table></div>
    </section>

    <section id="knowledge" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><BookOpen className="size-5" /></span><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">KNOWLEDGE BASE</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">规则知识库</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">公开规则文档先保存为对象存储与数据库事实记录，再由管理员服务端增量写入 FastAPI/Chroma 的 BGE 中文语义索引；仅显示“已同步”后才可承诺新规则已生效。</p></div></div><Button variant="outline" className="rounded-xl" onClick={() => seedKnowledge.mutate()} disabled={seedKnowledge.isPending}><Upload className="mr-2 size-4" />{seedKnowledge.isPending ? "正在初始化…" : "初始化演示规则"}</Button></div><div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-primary/25 bg-secondary/20 p-4"><input ref={uploadInputRef} type="file" accept=".md,.txt,text/plain,text/markdown" className="hidden" onChange={event => handleKnowledgeFile(event.target.files?.[0])} /><select value={uploadType} onChange={event => setUploadType(event.target.value as "policy" | "after_sales" | "faq")} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="policy">交易规则</option><option value="after_sales">售后说明</option><option value="faq">FAQ</option></select><input type="url" value={publicSourceUrl} onChange={event => setPublicSourceUrl(event.target.value)} placeholder="https://公开规则来源" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /><Button className="rounded-xl" onClick={() => uploadInputRef.current?.click()} disabled={uploadKnowledge.isPending}><Upload className="mr-2 size-4" />{uploadKnowledge.isPending ? "正在同步…" : "上传并同步 Chroma"}</Button><p className="text-xs text-muted-foreground">仅接受 .md/.txt、100KB 内且具有 HTTPS 公开来源的演示规则；不会传递用户、订单或密钥。</p></div><div className="mt-6 grid gap-3 md:grid-cols-3">{(knowledgeDocuments.data ?? []).map(document => <div key={document.id} className="rounded-xl border border-border bg-secondary/20 p-4"><div className="flex items-start justify-between gap-2"><p className="font-medium text-foreground">{document.title}</p><Badge variant={document.vectorIndexStatus === "synced" ? "secondary" : "outline"} className="shrink-0 font-normal">{document.vectorIndexStatus === "synced" ? "Chroma 已同步" : document.vectorIndexStatus === "failed" ? "同步失败" : document.vectorIndexStatus === "syncing" ? "同步中" : "待同步"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">文档：{document.processingStatus === "ready" ? "已分块" : document.processingStatus} · 索引：{document.vectorIndexVersion ?? "未建立"}</p>{document.vectorIndexError ? <p className="mt-2 text-xs leading-5 text-destructive">{document.vectorIndexError}</p> : null}<div className="mt-3 flex items-center gap-3"><a className="text-xs font-medium text-primary hover:underline" href={document.sourceUrl} target="_blank" rel="noreferrer">查看公开来源</a>{document.vectorIndexStatus !== "synced" ? <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => retryVectorSync.mutate({ documentId: document.id })} disabled={retryVectorSync.isPending}>{retryVectorSync.isPending ? "同步中…" : "重试同步"}</Button> : null}</div></div>)}</div></section>
    <section className="rounded-[1.5rem] border border-border bg-secondary/30 p-5"><div className="flex gap-3"><Database className="mt-0.5 size-5 text-primary" /><div><h2 className="font-display text-lg font-bold">面试说明：为什么后台权限要双重控制？</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">前端隐藏入口只避免普通用户误入；真实安全来自服务端 `adminProcedure`。即使直接构造 API 请求，服务端也会根据会话中的 `role` 返回禁止访问。</p></div></div></section>
  </div>;
}

export default function Admin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><div className="max-w-xl rounded-[1.5rem] border border-border bg-card p-8"><LockKeyhole className="size-6 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold">管理员登录验证</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">管理台仅在完成身份验证后可继续访问。</p><Button className="mt-6 rounded-xl" onClick={() => startLogin()}>前往登录</Button></div></main></div>;
  if (user.role !== "admin") return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><div className="max-w-xl rounded-[1.5rem] border border-destructive/30 bg-card p-8"><LockKeyhole className="size-6 text-destructive" /><h1 className="mt-5 font-display text-3xl font-bold">此处仅限管理员</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">你当前的普通用户身份没有后台权限；服务端也会拒绝所有管理员接口请求。</p></div></main></div>;
  return <DashboardLayout><AdminContent /></DashboardLayout>;
}
