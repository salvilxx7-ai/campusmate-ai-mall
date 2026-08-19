# CampusMate｜目标 RAG Agent 要求逐项核验（当前实现）

> **用途：** 本文用于将目标项目描述中的每一条主张与仓库中的代码、测试和演示流程对应。它不把“规划中”“模拟”或“未经测量”的事项写成已完成事实。

## 一、目标要求对照表

| 目标要求 | 当前状态 | 可验证实现与证据 | 简历/面试使用边界 |
|---|---|---|---|
| 校园二手商城核心页面与前后端联调 | 已实现 | React 19 前台、商品目录/详情、模拟下单、订单、个人中心、客服、项目说明、管理员后台；tRPC + Express + Drizzle + MySQL/TiDB。 | 可写“完成商城与管理端核心业务页面和前后端联调”；**不能写 15 个核心页面**，当前没有页面计数验收。 |
| 规则、售后、商品、FAQ 知识工程 | 已实现（演示范围） | 公开 C2C 来源改写的 Markdown/TXT 文档、滑动窗口分块、对象存储/MySQL 事实源、Chroma 派生索引、来源 URL。 | 必须称为“公开规则改写的演示知识库”，不是校方或平台正式政策。 |
| Top-K 召回、向量化、引用与无匹配转人工 | 已实现 | FastEmbed ONNX + `BAAI/bge-small-zh-v1.5` 512 维向量、Chroma Top-K、Node TF-IDF/余弦回退、引用返回、低置信阈值转人工；固定同义改写集 BGE Top-1 为 4/5、哈希基线 3/5。 | 可写“在固定 5 题演示集上比较 BGE 与哈希基线”；**不得外推为线上准确率**。 |
| LangGraph Agent 状态流转 | 已实现 | Python FastAPI sidecar 的 LangGraph 状态图；Node 保存 OAuth、订单与工具权限；工作流轨迹在客服页面展示。 | 可写 FastAPI + LangGraph + Chroma；需说明 Python 仅处理公开路由和公开规则。 |
| 商品、本人订单、工单工具 | 已实现并补齐 | `search_catalog`、`own_order_lookup`、`create_support_ticket` 以 OpenAI-compatible 原生 Function Calling 供模型选择；Node 重新校验参数和会话后执行；最小化真实探测已返回 `search_catalog({"query":"二手教材"})`；用户工单自有隔离，管理员队列支持状态流转。 | 可写“使用原生 Function Calling 暴露受限工具”；不要说模型直接访问数据库或订单。 |
| 用户身份校验和越权保护 | 已实现 | OAuth 会话、`protectedProcedure`、`adminProcedure`、订单所有权校验、拒绝审计、本人资料自有编辑、用户角色保护。 | 可写“服务端按会话实施最小权限”；不能仅用“前端隐藏”描述安全。 |
| 人工工单处理闭环 | 已实现（模拟范围） | 登录用户创建/查看自己的模拟工单，管理员处理 `open → in_review → resolved` 队列，状态操作审计。 | 必须称为“模拟人工工单”，不会联系真实客服或发送通知。 |
| 口语化、非法、越权等鲁棒性验证 | 已实现（固定用例） | 固定评测覆盖规则、无匹配、商品、本人订单、跨账户订单、人工转接；新增公开规则 6 题固定检索集，当前 Node TF-IDF/余弦评测为 Recall@3 100%、MRR 92%；另有 63 项 TypeScript 与 7 项 Python Agent 自动化测试。 | 可写“固定评测与自动化安全回归”；检索数字只描述当前演示语料与检索器，不暗示大规模线上压测。 |
| PHP | 不实现 | 当前后端真实技术是 Express/tRPC/TypeScript 与 Python FastAPI。 | **不得写 PHP。** |
| 页面加载 2 秒内 | 未测量 | 已完成生产构建，但没有 Lighthouse 或真实网络条件下的原始性能报告。 | **不得写 2 秒内加载。** 后续需采集 Web Vitals 后再写具体指标。 |
| 课程优秀项目/奖项 | 未提供证据 | 仓库没有成绩、证书或学校认定材料。 | **不得写获评课程优秀项目。** |

## 二、本轮新增的可验证补齐

| 补齐项 | 业务价值 | 安全设计 | 代码与测试证据 |
|---|---|---|---|
| 原生 Function Calling | 将商品、订单、工单从“规则匹配后的自定义分支”升级为模型可选择的受限工具。 | 模型只看到问题和工具可用性；Node 验证 JSON 参数、登录和显式人工请求后才执行。 | `server/agent/nativeToolCalling.ts`、`nativeToolCalling.test.ts`。 |
| 工单管理员队列 | 让“人工转接”从用户侧记录扩展到可演示的处理状态闭环。 | 用户只能看自己的工单；管理员接口由 `adminProcedure` 限制；状态更新追加审计。 | `admin.supportTickets`、`admin.updateSupportTicketStatus`、`adminSupportTicket.auth.test.ts`。 |
| 显式人工同意门槛 | 避免模型误把普通规则问题转为记录性操作。 | 只有登录用户明确表达人工、转接、投诉或提交工单请求时，`create_support_ticket` 才可用。 | `customerAgent.ts` 中的 `explicitHandoffRequest`。 |

## 三、可直接替换的项目经历版本

**CampusMate 校园二手商城与可溯源 RAG 智能客服｜个人作品集项目｜2025.11–2026.02（如该周期与实际开发记录一致）**

- 基于 React + TypeScript + Express/tRPC + MySQL/TiDB 搭建校园二手商城，完成商品发现、模拟订单、个人中心和管理员后台；服务端以 OAuth 会话限制订单、资料、工单的本人可见性，并对越权订单读取和管理操作追加审计。
- 建设公开 C2C 规则改写的演示知识库，采用滑动窗口分块和 FastEmbed ONNX 的 `BAAI/bge-small-zh-v1.5` 生成 512 维中文语义向量，写入 Chroma 派生索引；实现 Top-K 召回、可跳转来源引用、低置信转人工与 TF-IDF/余弦安全回退。
- 以 Python FastAPI + LangGraph 编排公开问题路由；通过 OpenAI-compatible Function Calling 暴露商品检索、本人订单和模拟工单工具，Node 网关对模型参数、OAuth 会话与人工请求进行二次校验，避免模型直接持有个人数据或数据库权限。
- 完成模拟人工工单闭环与管理员状态队列，并以固定 6 类 Agent 评测、固定 6 题检索质量评测、63 项 TypeScript 和 7 项 Python Agent 自动化测试覆盖引用、拒答、工具权限和越权边界。

## 四、下一批优先补齐项

后续最有价值的补齐不是增加虚构技术名词，而是采集**真实性能证据**和**检索质量证据**：在受控网络条件下保留 Lighthouse/Web Vitals 原始报告，并扩充带标准答案的公开规则评测集，计算 Recall@K、MRR 与人工抽检结果。只有在存在原始报告时，才把这些数字写入简历。
