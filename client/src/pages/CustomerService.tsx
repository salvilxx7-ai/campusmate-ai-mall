import { AIChatBox, type Message } from "@/components/AIChatBox";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Bot, ExternalLink, FileSearch, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useState } from "react";

type Citation = { documentId: number; title: string; excerpt: string; sourceLabel: string; sourceUrl: string; score: number };

const prompts = ["什么商品不能上架？", "签收后可以无理由退换吗？", "我想查一下我的订单", "有没有适合复习的教材？"];

export default function CustomerService() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [intent, setIntent] = useState<string | null>(null);
  const ask = trpc.customerService.ask.useMutation({
    onSuccess: data => {
      setMessages(previous => [...previous, { role: "assistant", content: data.answer }]);
      setCitations((data.citations ?? []) as Citation[]);
      setIntent(data.intent);
    },
    onError: error => {
      setMessages(previous => [...previous, { role: "assistant", content: `客服服务暂时不可用：${error.message}` }]);
      setCitations([]);
      setIntent(null);
    },
  });

  const send = (content: string) => {
    setMessages(previous => [...previous, { role: "user", content }]);
    setCitations([]);
    ask.mutate({ message: content });
  };

  return <div className="min-h-screen bg-background"><SiteHeader />
    <main className="container grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-12">
      <section>
        <div className="mb-6 max-w-2xl"><p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-primary"><Bot className="size-4" />CAMPUSMATE AI 智能客服</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.055em] text-foreground sm:text-5xl">先找证据，再给回答。</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">这里是 CampusMate 的 AI 智能客服。Agent 会先判断意图，再调用规则检索、商品检索、本人订单或人工转接工具。规则回答必须带引用；证据不足时会明确拒答并建议转人工。</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">规则问答附公开来源</span><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">可检索演示商品</span><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">订单仅限本人会话</span></div></div>
        <AIChatBox messages={messages} onSendMessage={send} isLoading={ask.isPending} height="560px" placeholder="例如：签收后可以无理由退换吗？" emptyStateMessage="我可以查规则、找商品或查询你的模拟订单。" suggestedPrompts={prompts} className="rounded-[1.5rem] border-border shadow-[0_22px_54px_-38px_rgba(45,33,60,0.45)]" />
      </section>
      <aside className="space-y-4 lg:pt-[5.8rem]">
        <Card className="rounded-[1.25rem] border-border bg-secondary/35 p-5"><div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-4" /><p className="text-xs font-semibold tracking-[0.13em]">回答边界</p></div><ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground"><li>规则问答必须检索证据并展示来源。</li><li>订单工具只读取当前登录账户的数据。</li><li>没有足够依据时转人工，不猜测规则。</li></ul><p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">知识库是基于公开 C2C 规则改写的演示集合，不是校方、闲鱼或 Meta 的正式政策。</p></Card>
        <Card className="rounded-[1.25rem] border-border bg-card p-5"><div className="flex items-center gap-2"><FileSearch className="size-4 text-primary" /><h2 className="font-display text-lg font-bold">本次依据</h2></div>{intent ? <Badge variant="secondary" className="mt-3 font-normal">意图：{intent}</Badge> : <p className="mt-3 text-sm text-muted-foreground">发送问题后，这里会显示检索证据。</p>}{citations.length > 0 ? <div className="mt-4 space-y-3">{citations.map(citation => <article key={`${citation.documentId}-${citation.score}`} className="rounded-xl border border-border bg-background p-3"><p className="text-xs font-semibold text-primary">{citation.sourceLabel} · {Math.round(citation.score * 100)}% 匹配</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{citation.excerpt}</p><a href={citation.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">查看公开来源 <ExternalLink className="size-3" /></a></article>)}</div> : null}</Card>
        <Card className="rounded-[1.25rem] border-border bg-primary p-5 text-primary-foreground"><div className="flex items-center gap-2"><UserRoundCheck className="size-4" /><p className="text-xs font-semibold tracking-[0.13em] text-[#decfee]">人工支持</p></div><p className="mt-3 text-sm leading-6 text-[#f0e8f5]">涉及真实支付、校方规定、法律责任或知识库未覆盖的问题，会引导你准备订单和沟通记录后转人工。</p><Link href="/goods" className="mt-4 inline-block text-sm font-semibold text-white underline-offset-4 hover:underline">继续浏览演示商品 →</Link></Card>
      </aside>
    </main>
  </div>;
}
