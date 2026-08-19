# CampusMate｜校园二手商城与可溯源 AI 客服

CampusMate 是一套面向作品集演示的全栈校园二手商城。项目将优雅的商品发现体验、严格隔离的模拟订单、基于公开规则改写的 RAG 客服、意图路由与固定评测面板整合在一起，重点展示 AI 应用工程中的**证据优先、权限优先与可复现评测**。

> **演示披露：** 商品、价格、卖家标签和订单均为演示数据，不包含真实支付、配送或售后服务。知识库只根据公开 C2C 规则改写，不是任何学校、闲鱼、Meta 或其他平台的正式政策。

## 功能概览

| 模块 | 已实现能力 |
|---|---|
| 商品商城与发布 | 商品浏览、关键词搜索、分类筛选、详情页与学院编辑风视觉设计；登录用户可上传 1–3 张图片、填写价格与详细描述提交闲置物品审核，并在“发布管理”编辑、撤回或重新提交自己的物品。 |
| 身份与订单 | 普通用户注册/登录与管理员授权的独立入口、Manus OAuth 会话、模拟下单、仅本人可见的订单列表/详情和越权拒绝审计。 |
| 个人中心 | 当前会话范围内的订单轨迹、待审核/展示中/已拒绝/已撤回的闲置物品、模拟工单进度、统计摘要与本人资料编辑；编辑会重新进入审核，且未登录或其他用户均不会获取个人数据。 |
| RAG 客服 | Node 侧 TF-IDF 兜底检索与 LLM 受控回答；Python FastAPI + LangGraph + Chroma 负责公开规则的意图路由与本地向量召回，规则回答保留引用与低置信转人工。 |
| Agent 路由 | 显式记录接收、意图分流、检索、受控工具调用、答案生成与转人工准备；商品、订单与工单工具始终由 Node 会话网关执行。 |
| 模拟工单 | 登录用户可将转人工上下文保存为仅本人可见的演示工单，并在个人中心查看已提交/处理中/已解决进度；创建和查询均由服务端会话限定并写入审计。 |
| 管理后台 | 仅管理员可见的商品状态筛选、待审核物品批量通过/拒绝（含拒绝原因与逐项审计）、单件商品维护、用户角色管理、模拟工单处理队列、演示规则初始化、受控文档上传、规则版本替换/失效和请求内批量索引重建。 |
| 评测 | 固定案例集、实际运行记录、意图正确率、引用完整性、拒答正确性和平均响应时间。 |

## 架构

```text
React 19 前端
  → tRPC 类型契约
  → Express 服务 + Manus OAuth 上下文（个人工具与 LLM 密钥）
  → localhost FastAPI + LangGraph（公开意图路由）
  → Chroma（FastEmbed ONNX 驱动的 BGE 中文预训练语义向量召回）
  → MySQL / Drizzle（商品、订单、知识、审计、评测）
  → Node 侧 TF-IDF 安全回退 → 受控 LLM 回答
  → 对象存储（管理员规则文档与普通用户发布图片的受控服务端写入）
```

订单工具从服务端会话读取当前用户，不接受前端指定的用户身份。跨账户订单读取会被拒绝并写入追加式审计记录。管理员入口即使在前端隐藏，服务端仍通过 `adminProcedure` 复核角色。

## 本地开发

项目使用 Manus 全栈模板的环境注入。安装依赖后，可运行：

```bash
pnpm dev
pnpm test
pnpm test:python-agent
pnpm test:all
pnpm check
```

数据库迁移位于 `drizzle/`。在受管环境中，使用已配置的数据库迁移流程同步表结构；不要提交 `.env`、真实用户数据、密钥或录屏原始素材。

## 演示路径

1. 从首页或“全部商品”浏览演示目录，搜索“教材”并查看商品详情。
2. 登录后进入“发布闲置物品”，上传 1–3 张 JPEG/PNG/WebP 图片、填写价格和详细描述，提交后进入“发布管理”；可演示编辑后重新审核、撤回或对已拒绝/已撤回物品重新提交。
3. 管理员在后台按状态筛选“待审核”，选择一个或多个商品批量通过或填写原因批量拒绝；再回到公开商品目录确认只有 `active` 商品可被浏览，待审核和拒绝商品不能通过直接详情 URL 读取。
4. 创建一笔模拟订单并进入“我的订单”查看仅当前账户可见的记录；在 AI 客服明确请求人工后，回到个人中心查看模拟工单的已提交/处理中/已解决状态。
5. 在桌面端点击顶部“AI 客服”，或在移动端点击右上角菜单中的“AI 客服”，也可使用首页的“问 AI 智能客服”按钮。依次提问“什么商品不能上架？”和“星际旅行需要带什么？”，展示有引用回答与低置信转人工。
6. 在管理员后台查看知识文档；上传一个有发布权的 `.md` 或 `.txt` 规则文件，并展示其同步状态、版本替换、失效与批量重建入口。
7. 打开“评测”，运行固定案例，展示来自 `evaluationRuns` 的实际结果；个人中心再编辑昵称、学校、专业和简介，说明数据始终由当前 OAuth 会话聚合。

## 公开规则来源

演示知识库仅使用下列公开资料中的一般性 C2C 原则，并进行了短篇改写与来源披露：

- [闲鱼社区用户服务协议](https://terms.alicdn.com/legal-agreement/terms/suit_bu1_other/suit_bu1_other201708081618_51146.html)
- [闲鱼社区交易争议处理规范](https://haibao.m.taobao.com/html/ce42wWSPf)
- [Facebook Marketplace：禁止上架的商品](https://www.facebook.com/help/130910837313345)

## 第三方参考与许可

商城业务流参考自 [Kraizan/Second-Hand](https://github.com/Kraizan/Second-Hand)（MIT License，参考提交 `dc795b3`），CampusMate 在当前 React + tRPC + MySQL 架构中重新实现。视觉建议参考 [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)（MIT License，参考提交 `8a1a6d8`）。详见 `docs/reference-marketplace-build-flow.md`。

## 测试覆盖

当前 69 项 TypeScript 测试覆盖 OAuth 登出与受限登录回跳、本人资料会话归属、普通用户图片格式/体积校验、发布认证、待审核公开隔离、发布状态机、本人编辑/撤回/重提、管理员批量审核权限及部分跳过、管理员用户目录拒绝、角色自改/最后管理员保护、原生 Function Calling 的成功/授权拒绝/回退测量、管理员工单队列拒绝与状态耗时、固定检索 Recall@K/MRR、预览参数下的 API JSON 回退、订单所有权、审计追加策略、客服显式工作流、模拟工单认证与归属、TF-IDF 稀有词排序、Node-to-FastAPI 索引网关边界、真实管理员 tRPC 上传/重试同步、规则版本替换/运行时 bootstrap/失效清理和六案例评测指标聚合；另有 7 项 Python Agent 测试验证 FastAPI、LangGraph、Chroma、BGE 中文语义召回、文档幂等 upsert 与删除、公开来源限制和个人数据零接触边界。运行 `pnpm test:all` 可验证完整测试集。

## 项目理解与面试复盘

本仓库将“能运行”与“能讲清楚”视为同等重要的交付要求。每次功能变更都会回顾并更新以下长期文档：

- [`docs/project-baseline.md`](./docs/project-baseline.md)：项目目标、业务验收、真实技术边界、非功能要求与每轮开发的强制复盘流程。
- [`docs/engineering-and-interview-log.md`](./docs/engineering-and-interview-log.md)：逐模块业务流程、数据流、失败处理、工程取舍与面试深挖问答。
- [`docs/end-to-end-business-flow.md`](./docs/end-to-end-business-flow.md)：从公开浏览、模拟下单、订单隔离、AI 工具、工单到管理员增量索引的完整业务流与答辩顺序。
- [`docs/ai-agent-capability-audit.md`](./docs/ai-agent-capability-audit.md)：用户目标陈述与当前实现的真实性核对。
- [`docs/target-rag-agent-claim-audit.md`](./docs/target-rag-agent-claim-audit.md)：目标 RAG Agent 要求、当前实现证据、可用表述与不得虚构边界的逐项核验。
- [`docs/runtime-evidence-and-delivery-inventory.md`](./docs/runtime-evidence-and-delivery-inventory.md)：原生 Function Calling 真实响应、固定检索质量结果与前端路由交付清单。
- [`docs/resume-ready-campusmate.md`](./docs/resume-ready-campusmate.md)：只使用已验证能力的简历项目表述，以及后续技术补齐路线。
