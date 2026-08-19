import DashboardLayout from "@/components/DashboardLayout";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, Clock3, FileCheck2, LockKeyhole, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function Metric({ icon: Icon, label, value, suffix = "%" }: { icon: typeof BarChart3; label: string; value: number; suffix?: string }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><Icon className="size-5 text-primary" /><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 font-mono text-3xl font-bold tracking-[-0.05em] text-foreground">{value}{suffix}</p></article>;
}

function EvaluationContent() {
  const utils = trpc.useUtils();
  const overview = trpc.admin.evaluationOverview.useQuery();
  const retrievalQuality = trpc.admin.retrievalQualityOverview.useQuery();
  const run = trpc.admin.runFixedEvaluation.useMutation({
    onSuccess: result => {
      toast.success("固定评测已完成", { description: `共运行 ${result.metrics.caseCount} 个案例。` });
      void utils.admin.evaluationOverview.invalidate();
    },
    onError: error => toast.error("评测运行失败", { description: error.message }),
  });
  const metrics = overview.data?.metrics ?? { caseCount: 0, intentAccuracy: 0, citationCompleteness: 0, refusalCorrectness: 0, averageLatencyMs: 0 };
  const retrievalMetrics = retrievalQuality.data ?? { k: 3, caseCount: 0, recallAtK: 0, meanReciprocalRank: 0, averageLatencyMs: 0, observations: [] };
  return <div className="mx-auto max-w-6xl space-y-7 pb-10"><section className="overflow-hidden rounded-[1.75rem] bg-primary p-7 text-primary-foreground shadow-[0_22px_54px_-32px_rgba(45,33,60,0.85)] sm:p-9"><p className="text-xs font-semibold tracking-[0.15em] text-[#d8c8e7]">REPRODUCIBLE EVALUATION</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.055em]">固定案例，实际记录。</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#eadff1]">面板不展示手工填写的“漂亮分数”。每次点击运行都会重新执行固定案例，将意图、引用、拒答和延迟写入 `evaluationRuns` 后再计算指标。</p><Button className="mt-6 rounded-xl bg-white text-primary hover:bg-white/90" onClick={() => run.mutate()} disabled={run.isPending}><Play className="mr-2 size-4 fill-current" />{run.isPending ? "正在运行…" : "运行固定评测"}</Button></section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric icon={CheckCircle2} label="意图正确率" value={metrics.intentAccuracy} /><Metric icon={FileCheck2} label="引用完整性" value={metrics.citationCompleteness} /><Metric icon={ShieldCheck} label="拒答正确性" value={metrics.refusalCorrectness} /><Metric icon={Clock3} label="平均响应时间" value={metrics.averageLatencyMs} suffix=" ms" /></section>
    <section className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7"><div className="flex items-center gap-3"><BarChart3 className="size-5 text-primary" /><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">RETRIEVAL QUALITY EVIDENCE</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">固定检索质量评测</h2></div></div><p className="mt-4 text-sm leading-6 text-muted-foreground">该组问题只取自当前公开演示规则，并以预期规则文档计算确定性 TF-IDF/余弦检索的 Recall@{retrievalMetrics.k} 和 MRR。它用于展示当前演示语料质量，不代表线上模型、真实用户或 BGE/Chroma 的生产准确率。</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric icon={FileCheck2} label={`Recall@${retrievalMetrics.k}`} value={retrievalMetrics.recallAtK} /><Metric icon={CheckCircle2} label="MRR" value={retrievalMetrics.meanReciprocalRank} /><Metric icon={Clock3} label="平均检索时间" value={retrievalMetrics.averageLatencyMs} suffix=" ms" /></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="px-4 py-3">固定问题</th><th className="px-4 py-3">预期规则</th><th className="px-4 py-3">首个相关排名</th><th className="px-4 py-3">Top-{retrievalMetrics.k} 返回</th></tr></thead><tbody>{retrievalMetrics.observations.map(item => <tr key={item.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4 text-foreground">{item.question}</td><td className="px-4 py-4 text-muted-foreground">{item.expectedDocumentTitle}</td><td className="px-4 py-4 font-mono text-primary">{item.firstRelevantRank ?? "未召回"}</td><td className="px-4 py-4 text-xs leading-5 text-muted-foreground">{item.retrievedDocumentTitles.join(" · ") || "无结果"}</td></tr>)}</tbody></table></div></section>
    <section className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-7"><div className="flex items-center gap-3"><BarChart3 className="size-5 text-primary" /><div><p className="text-xs font-semibold tracking-[0.14em] text-primary">FIXED CASE SET</p><h2 className="mt-1 font-display text-2xl font-bold tracking-[-0.04em]">评测案例与口径</h2></div></div><p className="mt-4 text-sm leading-6 text-muted-foreground">意图正确率比较预期与实际路由；引用完整性检查需要引用的政策案例是否返回对应文档；拒答正确性检查无匹配、未登录订单与跨账户订单场景。该面板的延迟是本次服务端实际计时，不等于生产 SLA。</p><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-border bg-secondary/35 text-xs font-semibold text-muted-foreground"><tr><th className="px-4 py-3">类型</th><th className="px-4 py-3">固定问题</th><th className="px-4 py-3">预期意图</th><th className="px-4 py-3">预期结果</th></tr></thead><tbody>{(overview.data?.cases ?? []).map(item => <tr key={item.id} className="border-b border-border/70 last:border-b-0"><td className="px-4 py-4 font-mono text-xs text-primary">{item.caseType}</td><td className="px-4 py-4 text-foreground">{item.question}</td><td className="px-4 py-4 text-muted-foreground">{item.expectedIntent}</td><td className="px-4 py-4 text-muted-foreground">{item.expectedOutcome}</td></tr>)}</tbody></table></div></section>
  </div>;
}

export default function Evaluation() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><div className="max-w-xl rounded-[1.5rem] border border-border bg-card p-8"><LockKeyhole className="size-6 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold">管理员登录验证</h1><p className="mt-2 text-sm text-muted-foreground">评测面板仅在身份验证后可继续访问。</p><Button className="mt-6 rounded-xl" onClick={() => startLogin()}>前往登录</Button></div></main></div>;
  if (user.role !== "admin") return <div className="min-h-screen bg-background"><SiteHeader /><main className="container py-16"><div className="max-w-xl rounded-[1.5rem] border border-destructive/30 bg-card p-8"><LockKeyhole className="size-6 text-destructive" /><h1 className="mt-5 font-display text-3xl font-bold">此处仅限管理员</h1><p className="mt-2 text-sm text-muted-foreground">普通用户看不到评测入口，服务端也会拒绝访问评测数据。</p></div></main></div>;
  return <DashboardLayout><EvaluationContent /></DashboardLayout>;
}
