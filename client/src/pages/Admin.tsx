import { SiteHeader } from "@/components/SiteHeader";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Archive, BookOpen, Database, LockKeyhole, Package, RefreshCw, ShieldCheck, TicketCheck, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { formatPrice, type CatalogProduct } from "@/components/ProductCard";
import { useRef, useState } from "react";
import { Link } from "wouter";

const statusLabel = { active: "已上架", reserved: "已保留", archived: "已下架" };

function AdminContent() {
  const utils = trpc.useUtils();
  const { user: currentUser } = useAuth();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"policy" | "after_sales" | "faq">("policy");
  const [publicSourceUrl, setPublicSourceUrl] = useState("");
  const [supersedesDocumentId, setSupersedesDocumentId] = useState<number | undefined>();
  const products = trpc.admin.products.useQuery();
  const userDirectory = trpc.admin.users.useQuery();
  const supportTickets = trpc.admin.supportTickets.useQuery();
  const knowledgeDocuments = trpc.admin.knowledgeDocuments.useQuery();
  const updateUserRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: result => {
      toast.success(result.changed ? "用户角色已更新" : "用户已处于该角色", { description: "本次角色操作已写入安全审计记录。" });
      void utils.admin.users.invalidate();
    },
    onError: error => toast.error("角色修改失败", { description: error.message }),
  });
  const updateTicketStatus = trpc.admin.updateSupportTicketStatus.useMutation({
    onSuccess: result => {
      toast.success(result.changed ? "工单状态已更新" : "工单已处于该状态", { description: `本次受控状态处理耗时 ${result.latencyMs} ms，且已写入安全审计记录。` });
      void utils.admin.supportTickets.invalidate();
      void utils.customerService.listMyTickets.invalidate();
    },
    onError: error => toast.error("工单状态更新失败", { description: error.message }),
  });
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
      setSupersedesDocumentId(undefined);
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
  const rebuildKnowledge = trpc.admin.rebuildKnowledgeVectorIndex.useMutation({
    onSuccess: result => {
      toast.success("批量重建已完成", { description: `成功 ${result.succeeded}/${result.total} 份规则${result.failed ? `，失败 ${result.failed} 份` : ""}。` });
      void utils.admin.knowledgeDocuments.invalidate();
    },
    onError: error => toast.error("批量重建失败", { description: error.message }),
  });
  const retireKnowledge = trpc.admin.retireKnowledgeDocument.useMutation({
    onSuccess: () => {
      toast.success("规则已失效", { description: "已从当前 Chroma 索引移除，并保留审计记录。" });
      void utils.admin.knowledgeDocuments.invalidate();
    },
    onError: error => toast.error("规则失效失败", { description: error.message }),
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
      uploadKnowledge.mutate({ fileName: file.name, mimeType: file.name.endsWith(".md") ? "text/markdown" : "text/plain", sourceType: uploadType, publicSourceUrl, base64Content: content, supersedesDocumentId });
    };
    reader.readAsDataURL(file);
  };

  const items = (products.data ?? []) as CatalogProduct[];
  const activeCount = items.filter(item => item.product.status === "active").length;
  const reservedCount = items.filter(item => item.product.status === "reserved").length;
  const replaceableDocuments = (knowledgeDocuments.data ?? []).filter(document => document.lifecycleStatus === "active" && !document.storageKey.startsWith("docs/knowledge-base/"));
  const managedUsers = userDirectory.data ?? [];
  const ticketQueue = supportTickets.data ?? [];
  const administratorCount = managedUsers.filter(managedUser => managedUser.role === "admin").length;
  const openTicketCount = ticketQueue.filter(ticket => ticket.status !== "resolved").length;

  const requestRoleChange = (targetUserId: number, targetLabel: string, nextRole: "user" | "admin") => {
    const action = nextRole === "admin" ? "提升为管理员" : "设为普通用户";
    if (!window.confirm(`确认将“${targetLabel}”${action}吗？该操作会立即改变后台访问权限并写入审计记录。`)) return;
    updateUserRole.mutate({ userId: targetUserId, role: nextRole });
  };

  return <div className="mx-auto max-w-6xl space-y-7 pb-10">
    <section className="overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground shadow-[0_22px_54px_-32px_rgba(45,33,60,0.85)] sm:p-9">
      <p className="text-xs font-semibold tracking-[0.15em] text-[#d8c8e7]">ADMINISTRATOR ONLY</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.055em]">CampusMate 管理台</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#eadff1]">所有操作均通过服务端 `adminProcedure` 校验。普通用户既看不到该入口，也无法通过直接请求绕过角色门槛。</p>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <div className="rounded-2xl border border-border bg-card p-5"><Package className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">目录商品</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{items.length}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><ShieldCheck className="size-5 text-accent" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">可下单</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{activeCount}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><Archive className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">已保留</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{reservedCount}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><UsersRound className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">注册账户</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{managedUsers.length}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><TicketCheck className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">待处理工单</p><p className="mt-1 font-mono text-3xl font-bold text-foreground">{openTicketCount}</p></div>
    </section>

    <section id="users" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">USER & ROLE CONTROL</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">用户角色管理</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">管理员可查看登录用户并调整其他账户的角色。普通用户无法调用该接口；当前账户不可修改自身角色，系统也会阻止降级最后一名管理员。</p></div><Badge variant="secondary" className="h-fit font-normal">管理员 {administratorCount} 名</Badge></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="px-4 py-3">用户</th><th className="px-4 py-3">学校 / 专业</th><th className="px-4 py-3">最近登录</th><th className="px-4 py-3">角色</th><th className="px-4 py-3 text-right">权限操作</th></tr></thead><tbody>{managedUsers.map(managedUser => { const label = managedUser.profileName || managedUser.oauthName || `用户 #${managedUser.id}`; const isCurrentUser = managedUser.id === currentUser?.id; const isLastAdministrator = managedUser.role === "admin" && administratorCount <= 1; return <tr key={managedUser.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4"><p className="font-medium text-foreground">{label}{isCurrentUser ? <span className="ml-2 text-xs text-muted-foreground">当前账户</span> : null}</p><p className="mt-1 max-w-56 truncate text-xs text-muted-foreground">{managedUser.email ?? "未提供邮箱"}</p></td><td className="px-4 py-4 text-muted-foreground">{[managedUser.campus, managedUser.major].filter(Boolean).join(" · ") || "未填写"}</td><td className="px-4 py-4 text-muted-foreground">{new Date(managedUser.lastSignedIn).toLocaleString("zh-CN")}</td><td className="px-4 py-4"><Badge variant={managedUser.role === "admin" ? "secondary" : "outline"} className="font-normal">{managedUser.role === "admin" ? "管理员" : "普通用户"}</Badge></td><td className="px-4 py-4 text-right">{isCurrentUser ? <span className="text-xs text-muted-foreground">为防止误锁定，不能修改自己</span> : managedUser.role === "admin" ? <Button size="sm" variant="outline" className="rounded-lg" disabled={updateUserRole.isPending || isLastAdministrator} title={isLastAdministrator ? "系统必须至少保留一名管理员" : undefined} onClick={() => requestRoleChange(managedUser.id, label, "user")}>{isLastAdministrator ? "保留最后管理员" : "设为普通用户"}</Button> : <Button size="sm" className="rounded-lg" disabled={updateUserRole.isPending} onClick={() => requestRoleChange(managedUser.id, label, "admin")}>提升为管理员</Button>}</td></tr>; })}</tbody></table></div>
      {userDirectory.isLoading ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-secondary" /> : null}
      {!userDirectory.isLoading && managedUsers.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">尚未检索到可管理的用户记录。</p> : null}
    </section>

    <section id="tickets" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">SIMULATED SUPPORT QUEUE</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">模拟工单处理队列</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">用户仅能查看自己的模拟工单；管理员可在此推进状态。工单不联系真实客服，所有状态流转由服务端管理员过程校验并写入审计。</p></div><Badge variant="secondary" className="h-fit font-normal">待处理 {openTicketCount} 条</Badge></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="px-4 py-3">工单</th><th className="px-4 py-3">用户</th><th className="px-4 py-3">摘要</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">处理操作</th></tr></thead><tbody>{ticketQueue.map(ticket => { const requester = ticket.requesterProfileName || ticket.requesterName || `用户 #${ticket.userId}`; const next = ticket.status === "open" ? { value: "in_review" as const, label: "开始处理" } : ticket.status === "in_review" ? { value: "resolved" as const, label: "标记已解决" } : { value: "open" as const, label: "重新打开" }; return <tr key={ticket.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4"><p className="font-mono text-xs font-semibold text-primary">{ticket.ticketCode}</p><p className="mt-1 text-xs text-muted-foreground">{ticket.category} · {new Date(ticket.createdAt).toLocaleString("zh-CN")}</p></td><td className="px-4 py-4"><p className="font-medium text-foreground">{requester}</p><p className="mt-1 max-w-44 truncate text-xs text-muted-foreground">{ticket.requesterEmail ?? "未提供邮箱"}</p></td><td className="max-w-sm px-4 py-4 text-xs leading-5 text-muted-foreground">{ticket.summary}</td><td className="px-4 py-4"><Badge variant={ticket.status === "resolved" ? "outline" : "secondary"} className="font-normal">{ticket.status === "open" ? "待处理" : ticket.status === "in_review" ? "处理中" : "已解决"}</Badge></td><td className="px-4 py-4 text-right"><Button size="sm" variant={ticket.status === "resolved" ? "outline" : "default"} className="rounded-lg" disabled={updateTicketStatus.isPending} onClick={() => updateTicketStatus.mutate({ ticketId: ticket.id, status: next.value })}>{next.label}</Button></td></tr>; })}</tbody></table></div>
      {supportTickets.isLoading ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-secondary" /> : null}
      {!supportTickets.isLoading && ticketQueue.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">尚无模拟工单。用户在客服中明确请求人工支持后可创建记录。</p> : null}
    </section>

    <section id="products" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">CATALOG CONTROL</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">演示商品管理</h2><p className="mt-2 text-sm text-muted-foreground">目录数据明确标注为演示内容；状态更新会被记录为安全审计事件。</p></div><Button variant="outline" className="rounded-xl" onClick={() => seed.mutate()} disabled={seed.isPending}><RefreshCw className={`mr-2 size-4 ${seed.isPending ? "animate-spin" : ""}`} />{seed.isPending ? "正在检查…" : "初始化演示目录"}</Button></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="px-4 py-3">商品</th><th className="px-4 py-3">分类</th><th className="px-4 py-3">价格</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody>{items.map(item => <tr key={item.product.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4 font-medium text-foreground">{item.product.title}</td><td className="px-4 py-4 text-muted-foreground">{item.category.name}</td><td className="px-4 py-4 font-mono font-semibold">{formatPrice(item.product.priceCents)}</td><td className="px-4 py-4"><Badge variant="secondary" className="font-normal">{statusLabel[item.product.status]}</Badge></td><td className="px-4 py-4 text-right">{item.product.status === "archived" ? <Button size="sm" className="rounded-lg" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ productId: item.product.id, status: "active" })}>重新上架</Button> : <Button size="sm" variant="outline" className="rounded-lg" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ productId: item.product.id, status: "archived" })}>下架</Button>}</td></tr>)}</tbody></table></div>
    </section>

    <section id="knowledge" className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><BookOpen className="size-5" /></span><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">KNOWLEDGE BASE</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">规则知识库</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">对象存储与数据库保存规则事实；当前请求可将有效公开规则写入 FastAPI/Chroma。sidecar 重启后首个规则请求会恢复有效文档，批量重建不需要常驻队列。</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-xl" onClick={() => seedKnowledge.mutate()} disabled={seedKnowledge.isPending}><Upload className="mr-2 size-4" />{seedKnowledge.isPending ? "正在初始化…" : "初始化演示规则"}</Button><Button variant="outline" className="rounded-xl" onClick={() => rebuildKnowledge.mutate()} disabled={rebuildKnowledge.isPending}><RefreshCw className={`mr-2 size-4 ${rebuildKnowledge.isPending ? "animate-spin" : ""}`} />{rebuildKnowledge.isPending ? "正在逐份重建…" : "批量重建有效规则"}</Button></div>
      </div>
      <div className="mt-5 grid gap-3 rounded-xl border border-dashed border-primary/25 bg-secondary/20 p-4 lg:grid-cols-[0.8fr_1.2fr_1.2fr_auto]">
        <input ref={uploadInputRef} type="file" accept=".md,.txt,text/plain,text/markdown" className="hidden" onChange={event => handleKnowledgeFile(event.target.files?.[0])} />
        <select value={uploadType} onChange={event => setUploadType(event.target.value as "policy" | "after_sales" | "faq")} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="policy">交易规则</option><option value="after_sales">售后说明</option><option value="faq">FAQ</option></select>
        <input type="url" value={publicSourceUrl} onChange={event => setPublicSourceUrl(event.target.value)} placeholder="https://公开规则来源" className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
        <select value={supersedesDocumentId?.toString() ?? ""} onChange={event => setSupersedesDocumentId(event.target.value ? Number(event.target.value) : undefined)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">新增独立规则</option>{replaceableDocuments.map(document => <option key={document.id} value={document.id}>替换：{document.title}（v{document.version}）</option>)}</select>
        <Button className="rounded-xl" onClick={() => uploadInputRef.current?.click()} disabled={uploadKnowledge.isPending}><Upload className="mr-2 size-4" />{uploadKnowledge.isPending ? "正在同步…" : supersedesDocumentId ? "上传新版本" : "上传并同步 Chroma"}</Button>
        <p className="lg:col-span-4 text-xs text-muted-foreground">仅接受 .md/.txt、100KB 内且具有 HTTPS 公开来源的规则。替换操作会先同步新版本，成功后才将旧版本失效；失效规则不会进入客服回退检索。</p>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(knowledgeDocuments.data ?? []).map(document => <div key={document.id} className="rounded-xl border border-border bg-secondary/20 p-4"><div className="flex items-start justify-between gap-2"><p className="font-medium text-foreground">{document.title}</p><Badge variant={document.lifecycleStatus === "active" && document.vectorIndexStatus === "synced" ? "secondary" : "outline"} className="shrink-0 font-normal">{document.lifecycleStatus === "active" ? document.vectorIndexStatus === "synced" ? "Chroma 已同步" : document.vectorIndexStatus === "failed" ? "同步失败" : document.vectorIndexStatus === "syncing" ? "同步中" : "待同步" : document.lifecycleStatus === "superseded" ? "已替代" : "已失效"}</Badge></div><p className="mt-2 text-xs text-muted-foreground">v{document.version} · {document.processingStatus === "ready" ? "已分块" : document.processingStatus} · 索引：{document.vectorIndexVersion ?? "未建立"}</p>{document.supersedesDocumentId ? <p className="mt-1 text-xs text-muted-foreground">替代规则 #{document.supersedesDocumentId}</p> : null}{document.retiredReason ? <p className="mt-1 text-xs text-muted-foreground">状态说明：{document.retiredReason}</p> : null}{document.vectorIndexError ? <p className="mt-2 text-xs leading-5 text-destructive">{document.vectorIndexError}</p> : null}<div className="mt-3 flex flex-wrap items-center gap-2"><a className="text-xs font-medium text-primary hover:underline" href={document.sourceUrl} target="_blank" rel="noreferrer">查看公开来源</a>{document.lifecycleStatus === "active" && document.vectorIndexStatus !== "synced" ? <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => retryVectorSync.mutate({ documentId: document.id })} disabled={retryVectorSync.isPending}>{retryVectorSync.isPending ? "同步中…" : "重试同步"}</Button> : null}{document.lifecycleStatus === "active" && !document.storageKey.startsWith("docs/knowledge-base/") ? <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs text-destructive hover:text-destructive" onClick={() => retireKnowledge.mutate({ documentId: document.id, reason: "管理员在规则管理台将该版本设为失效" })} disabled={retireKnowledge.isPending}>{retireKnowledge.isPending ? "处理中…" : "设为失效"}</Button> : null}</div></div>)}</div>
    </section>
    <section className="rounded-[1.5rem] border border-border bg-secondary/30 p-5"><div className="flex gap-3"><Database className="mt-0.5 size-5 text-primary" /><div><h2 className="font-display text-lg font-bold">面试说明：为什么后台权限要双重控制？</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">前端隐藏入口只避免普通用户误入；真实安全来自服务端 `adminProcedure`。即使直接构造 API 请求，服务端也会根据会话中的 `role` 返回禁止访问。</p></div></div></section>
  </div>;
}

export default function Admin() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><div className="max-w-xl rounded-[1.5rem] border border-border bg-card p-8"><LockKeyhole className="size-6 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.14em] text-primary">ADMINISTRATOR ACCESS</p><h1 className="mt-2 font-display text-3xl font-bold">管理员登录验证</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">请使用已由系统配置为管理员的账号完成授权。选择此入口不会创建管理员角色，首次普通用户授权仍默认为用户角色。</p><Button asChild className="mt-6 rounded-xl"><Link href="/login">前往管理员登录</Link></Button></div></main></div>;
  if (user.role !== "admin") return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><div className="max-w-xl rounded-[1.5rem] border border-destructive/30 bg-card p-8"><LockKeyhole className="size-6 text-destructive" /><h1 className="mt-5 font-display text-3xl font-bold">此处仅限管理员</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">你当前的普通用户身份没有后台权限；服务端也会拒绝所有管理员接口请求。</p><Button asChild variant="outline" className="mt-6 rounded-xl"><Link href="/">回到商城</Link></Button></div></main></div>;
  return <DashboardLayout><AdminContent /></DashboardLayout>;
}
