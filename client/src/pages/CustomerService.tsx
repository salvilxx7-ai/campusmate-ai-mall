import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot, ExternalLink, FileSearch, GitBranch, Headphones, KeyRound, ShieldCheck, TicketCheck, UserRoundCheck, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

type Citation = { documentId: number; title: string; excerpt: string; sourceLabel: string; sourceUrl: string; score: number };
type WorkflowStep = { stage: "received" | "intent_routed" | "retrieval" | "tool_invoked" | "answer_generated" | "handoff_ready"; detail: string };
type ToolResult = { tool: "knowledge_search" | "product_search" | "own_order_lookup" | "handoff_advice" | "handoff_ticket"; status: "completed" | "blocked" | "not_found"; summary: string };
type Intent = "policy_qa" | "product_search" | "own_order" | "human_handoff";

const prompts = ["什么商品不能上架？", "签收后可以无理由退换吗？", "我想查一下我的订单", "有没有适合复习的教材？"];
const stageLabel: Record<WorkflowStep["stage"], string> = { received: "接收问题", intent_routed: "意图分流", retrieval: "Chroma 检索", tool_invoked: "调用工具", answer_generated: "生成回答", handoff_ready: "准备转人工" };
const toolLabel: Record<ToolResult["tool"], string> = { knowledge_search: "知识检索", product_search: "商品检索", own_order_lookup: "本人订单", handoff_advice: "人工转接", handoff_ticket: "工单提交" };
const toolTone: Record<ToolResult["status"], string> = { completed: "bg-emerald-50 text-emerald-700", blocked: "bg-rose-50 text-rose-700", not_found: "bg-amber-50 text-amber-700" };

function ticketCategory(intent: Intent | null): "policy" | "order" | "security" | "other" {
  if (intent === "policy_qa") return "policy";
  if (intent === "own_order") return "order";
  return "other";
}

function dateLabel(value: Date | string) {
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CustomerService() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [messages, setMessages] = useState<Message[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [lastQuestion, setLastQuestion] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [needsHandoff, setNeedsHandoff] = useState(false);
  const [automaticTicketCode, setAutomaticTicketCode] = useState<string | null>(null);
  const tickets = trpc.customerService.listMyTickets.useQuery(undefined, { enabled: Boolean(user) });
  const createTicket = trpc.customerService.createTicket.useMutation({ onSuccess: () => void utils.customerService.listMyTickets.invalidate() });
  const ask = trpc.customerService.ask.useMutation({
    onSuccess: data => {
      setMessages(previous => [...previous, { role: "assistant", content: data.answer }]);
      setCitations((data.citations ?? []) as Citation[]);
      setIntent(data.intent as Intent);
      setWorkflow(data.workflow as WorkflowStep[]);
      setToolResults(data.toolResults as ToolResult[]);
      setLastAnswer(data.answer);
      setNeedsHandoff(data.handoff);
      const createdTicket = "ticket" in data ? data.ticket : undefined;
      setAutomaticTicketCode(createdTicket?.ticketCode ?? null);
      if (createdTicket) void utils.customerService.listMyTickets.invalidate();
    },
    onError: error => {
      setMessages(previous => [...previous, { role: "assistant", content: `客服服务暂时不可用：${error.message}` }]);
      setCitations([]);
      setIntent(null);
      setWorkflow([]);
      setToolResults([]);
      setNeedsHandoff(false);
    },
  });

  const send = (content: string) => {
    setMessages(previous => [...previous, { role: "user", content }]);
    setCitations([]);
    setWorkflow([]);
    setToolResults([]);
    setLastQuestion(content);
    setLastAnswer("");
    setNeedsHandoff(false);
    setAutomaticTicketCode(null);
    ask.mutate({ message: content });
  };

  const submitTicket = () => {
    if (!lastQuestion || !lastAnswer || workflow.length === 0) return;
    createTicket.mutate({ category: ticketCategory(intent), sourceMessage: lastQuestion, summary: lastAnswer, workflowTrace: workflow });
  };

  return <div className="min-h-screen bg-background"><SiteHeader />
    <main className="container grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-12">
      <section>
        <div className="mb-6 max-w-2xl"><p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-primary"><Bot className="size-4" />CAMPUSMATE AI 智能客服</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.055em] text-foreground sm:text-5xl">先找证据，再给回答。</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">这里是 CampusMate 的 AI 智能客服。Agent 会显式记录意图分流、规则/商品/本人订单工具调用与转人工准备步骤。规则回答必须带引用；证据不足时会明确拒答并允许登录用户创建模拟工单。</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">规则问答附公开来源</span><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">可检索演示商品</span><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">订单仅限本人会话</span></div></div>
        <AIChatBox messages={messages} onSendMessage={send} isLoading={ask.isPending} height="560px" placeholder="例如：签收后可以无理由退换吗？" emptyStateMessage="我可以查规则、找商品或查询你的模拟订单。" suggestedPrompts={prompts} className="rounded-[1.5rem] border-border shadow-[0_22px_54px_-38px_rgba(45,33,60,0.45)]" />
      </section>
      <aside className="space-y-4 lg:pt-[5.8rem]">
        <Card className="rounded-[1.25rem] border-border bg-secondary/35 p-5"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-4" /><p className="text-xs font-semibold tracking-[0.13em]">回答边界</p></div><ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground"><li>规则问答必须检索证据并展示来源。</li><li>订单工具只读取当前登录账户的数据。</li><li>没有足够依据时转人工，不猜测规则。</li></ul><p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">知识库是基于公开 C2C 规则改写的演示集合，不是校方、闲鱼或 Meta 的正式政策。</p></Card>
        <Card className="rounded-[1.25rem] border-border bg-card p-5"><div className="flex items-center gap-2"><FileSearch className="size-4 text-primary" /><h2 className="font-display text-lg font-bold">本次依据</h2></div>{intent ? <Badge variant="secondary" className="mt-3 font-normal">意图：{intent}</Badge> : <p className="mt-3 text-sm text-muted-foreground">发送问题后，这里会显示检索证据。</p>}{citations.length > 0 ? <div className="mt-4 space-y-3">{citations.map(citation => <article key={`${citation.documentId}-${citation.score}`} className="rounded-xl border border-border bg-background p-3"><p className="text-xs font-semibold text-primary">{citation.sourceLabel} · {Math.round(citation.score * 100)}% 匹配</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{citation.excerpt}</p><a href={citation.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">查看公开来源 <ExternalLink className="size-3" /></a></article>)}</div> : null}</Card>
        <Card className="rounded-[1.25rem] border-border bg-card p-5"><div className="flex items-center gap-2"><GitBranch className="size-4 text-primary" /><h2 className="font-display text-lg font-bold">Agent 工作流</h2></div>{workflow.length === 0 ? <p className="mt-3 text-sm leading-6 text-muted-foreground">本次对话的意图、工具调用与安全分支会在这里以步骤链路展示。</p> : <ol className="mt-4 space-y-3">{workflow.map((step, index) => <li key={`${step.stage}-${index}`} className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{index + 1}</span><div><p className="text-xs font-semibold text-foreground">{stageLabel[step.stage]}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></div></li>)}</ol>}{toolResults.length > 0 ? <div className="mt-4 border-t border-border pt-4"><p className="inline-flex items-center gap-2 text-xs font-semibold text-foreground"><Wrench className="size-3.5 text-primary" />工具结果</p><div className="mt-2 space-y-2">{toolResults.map(result => <div key={`${result.tool}-${result.status}`} className="rounded-lg bg-secondary/40 p-2.5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium">{toolLabel[result.tool]}</p><Badge className={`border-0 text-[10px] ${toolTone[result.status]}`}>{result.status}</Badge></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{result.summary}</p></div>)}</div></div> : null}</Card>
        {needsHandoff ? <Card className="rounded-[1.25rem] border-primary/20 bg-primary p-5 text-primary-foreground"><div className="flex items-center gap-2"><Headphones className="size-4" /><p className="text-xs font-semibold tracking-[0.13em] text-[#decfee]">模拟人工工单</p></div><p className="mt-3 text-sm leading-6 text-[#f0e8f5]">当前问题已触发转人工建议。创建后，问题、受控回答和工作流轨迹将只保存在你的演示账户下。</p>{automaticTicketCode ? <p className="mt-4 rounded-lg bg-white/10 p-3 text-xs leading-5 text-[#f3ebf7]">原生工具已创建 {automaticTicketCode}。管理员可在演示后台更新处理状态；它不会联系真实客服。</p> : !user ? <Button variant="secondary" className="mt-4 w-full rounded-xl" onClick={() => startLogin()}><KeyRound className="size-4" />登录后创建工单</Button> : <Button variant="secondary" className="mt-4 w-full rounded-xl" onClick={submitTicket} disabled={createTicket.isPending}>{createTicket.isPending ? "正在创建…" : "创建模拟工单"}</Button>}{createTicket.data ? <p className="mt-3 rounded-lg bg-white/10 p-3 text-xs leading-5 text-[#f3ebf7]">已创建 {createTicket.data.ticketCode}。它不会联系真实客服，仅用于展示安全的转接闭环。</p> : null}</Card> : null}
        <Card className="rounded-[1.25rem] border-border bg-card p-5"><div className="flex items-center gap-2"><TicketCheck className="size-4 text-primary" /><h2 className="font-display text-lg font-bold">我的模拟工单</h2></div>{!user ? <p className="mt-3 text-sm leading-6 text-muted-foreground">登录后可查看仅属于当前账户的模拟工单记录。</p> : tickets.isLoading ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-secondary" /> : tickets.data?.length ? <div className="mt-4 space-y-2">{tickets.data.slice(0, 3).map(ticket => <div key={ticket.id} className="rounded-xl border border-border bg-secondary/25 p-3"><div className="flex items-center justify-between gap-2"><p className="font-mono text-xs font-semibold text-primary">{ticket.ticketCode}</p><Badge variant="secondary" className="text-[10px] font-normal">{ticket.status}</Badge></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{ticket.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">{dateLabel(ticket.createdAt)} · 演示数据</p></div>)}</div> : <p className="mt-3 text-sm leading-6 text-muted-foreground">尚未创建模拟工单。仅在需要人工支持时出现创建入口。</p>}</Card>
        <Card className="rounded-[1.25rem] border-border bg-primary p-5 text-primary-foreground"><div className="flex items-center gap-2"><UserRoundCheck className="size-4" /><p className="text-xs font-semibold tracking-[0.13em] text-[#decfee]">人工支持</p></div><p className="mt-3 text-sm leading-6 text-[#f0e8f5]">涉及真实支付、校方规定、法律责任或知识库未覆盖的问题，会引导你准备订单和沟通记录后创建模拟工单。</p><Link href="/goods" className="mt-4 inline-block text-sm font-semibold text-white underline-offset-4 hover:underline">继续浏览演示商品 →</Link></Card>
      </aside>
    </main>
  </div>;
}
