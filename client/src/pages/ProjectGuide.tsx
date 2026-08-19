import { SiteHeader } from "@/components/SiteHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Bot, Database, FileSearch, KeyRound, Layers3, ShieldCheck, type LucideIcon } from "lucide-react";

const modules: Array<{ title: string; description: string; Icon: LucideIcon }> = [
  { title: "商品与订单", description: "公开商品发现、登录后模拟下单，以及仅本人可见的订单空间", Icon: ShieldCheck },
  { title: "RAG 知识库", description: "BGE/Chroma 语义召回、TF-IDF 回退、来源片段、规则版本与低置信转人工", Icon: FileSearch },
  { title: "Agent 路由", description: "FastAPI + LangGraph + Chroma 公开路由；原生 Function Calling 选工具，Node 网关执行商品、订单与工单", Icon: Bot },
  { title: "权限与审计", description: "OAuth 会话、管理员过程、所有者验证、角色保护与追加式安全记录", Icon: KeyRound },
];

const systemFlow = [
  ["React", "学院编辑风前台"],
  ["tRPC", "端到端类型契约"],
  ["Express", "会话与工具边界"],
  ["FastAPI", "Python Agent 网关"],
  ["LangGraph + Chroma", "状态图与公开规则召回"],
  ["MySQL + LLM", "审计数据与受控生成"],
];

export default function ProjectGuide() {
  return <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="container py-10 sm:py-14">
      <section className="grid gap-6 rounded-[1.75rem] bg-primary p-7 text-primary-foreground shadow-[0_22px_54px_-32px_rgba(45,33,60,0.85)] lg:grid-cols-[1.3fr_0.7fr] lg:p-10">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#d8c8e7]">PROJECT DOCUMENTATION</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.06em] sm:text-5xl">把可信边界，做成可演示的产品。</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#eee5f4]">CampusMate 将校园二手交易的前台体验、模拟订单权限、RAG 客服与可复现评测组合为一套可讲清工程取舍的 AI 应用作品。</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-5">
          <p className="text-xs font-semibold tracking-[0.13em] text-[#ddcfeb]">DEMO DISCLOSURE</p>
          <p className="mt-3 font-display text-2xl font-bold">所有商品、订单与规则均明确标注为演示。</p>
          <p className="mt-3 text-sm leading-6 text-[#eee5f4]">公开 C2C 规则用于来源明确的改写，不构成校方政策、法律意见或真实售后承诺。</p>
        </div>
      </section>

      <section className="mt-10">
        <p className="text-xs font-semibold tracking-[0.15em] text-primary">SYSTEM FLOW</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">从页面到证据，再到可审计结果。</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {systemFlow.map(([title, description], index) => <div key={title} className="relative rounded-2xl border border-border bg-card p-5"><span className="font-mono text-xs text-primary">0{index + 1}</span><p className="mt-5 font-display text-xl font-bold">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>)}
        </div>
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        {modules.map(({ title, description, Icon }) => <article key={title} className="rounded-[1.25rem] border border-border bg-card p-6"><Icon className="size-5 text-primary" /><h3 className="mt-5 font-display text-2xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></article>)}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-primary">INTERVIEW DEEP DIVE</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em]">面试官可以一直追问。</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">下面的问题对应实际代码中的路由、表结构、检索器、审计函数与测试，而不是只停留在功能描述。</p>
          <Badge variant="secondary" className="mt-5 font-normal">63 项 TypeScript + 7 项 Python 自动化测试</Badge>
        </div>
        <Accordion type="single" collapsible className="rounded-[1.25rem] border border-border bg-card px-5">
          <AccordionItem value="rag"><AccordionTrigger>为什么检索低分时要拒答？</AccordionTrigger><AccordionContent>因为模型的流畅表达不能替代事实依据。CampusMate 的 Node 回退检索与 Chroma 检索都受阈值控制；若仍无足够证据，就明确提示知识库覆盖不足并转人工。</AccordionContent></AccordionItem>
          <AccordionItem value="orders"><AccordionTrigger>订单隔离如何抵抗直接 API 调用？</AccordionTrigger><AccordionContent>服务端从 OAuth 会话获得当前用户，不接受客户端传入的用户 ID。订单详情额外检查订单所有者；跨账户访问被拒绝并追加审计。</AccordionContent></AccordionItem>
          <AccordionItem value="profile"><AccordionTrigger>为什么用户只能改昵称、学校、专业和简介？</AccordionTrigger><AccordionContent>这四项是 CampusMate 独立资料，不影响认证和授权。OAuth 姓名、邮箱由身份提供商控制；资料更新从服务端会话取得用户 ID，因此客户端不能编辑其他用户资料。</AccordionContent></AccordionItem>
          <AccordionItem value="workflow"><AccordionTrigger>为什么 Python Agent 不直接查询订单？</AccordionTrigger><AccordionContent>FastAPI/LangGraph 只接收公开问题并返回意图和规则证据，既不读取 Cookie，也不拥有订单数据库凭据。Node 网关完成 OAuth 验证后才执行商品、订单或工单工具，从而保持最小权限。</AccordionContent></AccordionItem>
          <AccordionItem value="admin"><AccordionTrigger>为什么还要在服务端限制管理员？</AccordionTrigger><AccordionContent>前端隐藏只能改善体验。真正的角色门槛由 tRPC 的 adminProcedure 在服务端拦截；普通用户直连后台 API 也会收到 FORBIDDEN。角色管理还会阻止管理员修改自身角色或移除最后一名管理员。</AccordionContent></AccordionItem>
          <AccordionItem value="api"><AccordionTrigger>为什么 API 不能回退成页面 HTML？</AccordionTrigger><AccordionContent>tRPC 协议期待 JSON。若未命中的 API 路径返回 index.html，客户端只会得到难以诊断的 HTML 解析错误；CampusMate 将 API 回退显式限定为 JSON，并固定同源 API 端点。</AccordionContent></AccordionItem>
          <AccordionItem value="evaluation"><AccordionTrigger>评测指标为何可信？</AccordionTrigger><AccordionContent>固定案例、预期意图、预期结果和必需引用均存储在数据库。每次运行生成新的 evaluationRuns，面板从实际运行记录聚合百分比和延迟。</AccordionContent></AccordionItem>
        </Accordion>
      </section>
    </main>
  </div>;
}
