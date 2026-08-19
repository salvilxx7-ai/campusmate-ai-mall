# CampusMate AI Agent 能力真实性审计

**审计日期：** 2026-08-19  
**审计依据：** 当前仓库的运行脚本、依赖、数据库模型、Agent/RAG 实现、路由与 Vitest 测试。

## 结论摘要

CampusMate 已实现一个可运行的、具有引用与权限边界的校园商城客服 Agent。其真实技术路线为 **React + TypeScript + Express/tRPC + MySQL/Drizzle + Python FastAPI + LangGraph + Chroma + FastEmbed ONNX + BAAI/bge-small-zh-v1.5 + Node 侧 TF-IDF/余弦安全回退 + 内置 LLM API**。Chroma 使用 512 维预训练中文语义向量和受版本控制的演示语料；管理员上传的 HTTPS 公开规则可增量同步至当前 sidecar，并保存索引状态、版本、错误与重试证据。新的 Python 运行实例会在首次公开规则请求前 bootstrap 当前有效规则；仍没有证据支持“15 个核心页面”或“页面加载优化至 2 秒内”。

## 逐项核对

| 用户提供的陈述 | 当前 CampusMate 状态 | 真实可用表述 | 后续处理 |
|---|---|---|---|
| 清洗业务规则、售后、商品资料、FAQ | **已实现（演示范围）** | 基于公开 C2C 原则改写的规则、售后与 FAQ 演示知识文档，并支持管理员上传 Markdown/TXT 文档。 | 保留并扩展结构化来源元数据。 |
| 滑动窗口分块 | **部分实现** | Node 知识库仍采用确定性段落聚合；Python Chroma 演示语料使用 260 字符、48 字符重叠的滑动窗口。 | 将管理员文档也接入同一可配置窗口并对比召回。 |
| Embedding + Chroma 向量库 | **已实现（公开规则范围）** | Python FastAPI 服务通过 FastEmbed ONNX 使用 `BAAI/bge-small-zh-v1.5` 的 512 维预训练中文语义向量完成公开规则 Top-K 召回；管理员上传 HTTPS 公开规则可按指纹幂等 upsert 至 Chroma，Node 保留 TF-IDF 回退。固定 5 题演示集为 BGE 4/5、哈希基线 3/5。 | Chroma 为容器本地派生索引，首次公开规则请求会 bootstrap 当前有效文档；小样本结果不能外推为生产准确率。 |
| 带溯源 Prompt、引用、无匹配转人工 | **已实现** | 规则问答将检索证据写入受控 Prompt，页面展示公开来源；低置信问题拒答并转人工建议。 | 增加结构化工具轨迹与工单落库。 |
| LangGraph 状态流转 | **已实现（公开路由范围）** | Python sidecar 使用 LangGraph 状态图执行接收、意图分流、Chroma 检索/交还 Node 网关步骤。 | 若需多轮可恢复状态，再增加会话持久化与 checkpoint。 |
| Function Calling 商品/订单/工单工具 | **已实现（受限工具范围）** | `search_catalog`、`own_order_lookup`、`create_support_ticket` 以 OpenAI-compatible 原生 Function Calling 提供给模型；模型只返回名称/参数，Node 重新验证参数、OAuth 会话与显式人工请求后执行本地工具，并输出工作流与工具结果。 | 不得写模型直接访问数据库、订单或密钥；模型不可用时回退确定性/Python 路由。 |
| 身份校验与越权限制 | **已实现** | OAuth 会话注入 tRPC 上下文；订单、资料和工单分别按会话所有权校验，管理员工单队列由 `adminProcedure` 限制，拒绝请求与状态操作写入追加式审计。 | 不得把前端入口隐藏表述为唯一安全控制。 |
| 15 个核心页面 | **未证实** | 当前有商城、商品、订单、客服、个人中心、后台、评测与项目说明等路由，但未以“15 个核心页面”作为验收指标。 | 仅在逐页清点并完成对应验收后再写数量。 |
| 页面加载优化至 2 秒内 | **未证实** | 已完成响应式页面与生产构建；未保存真实用户环境下的性能测量。 | 建立可复现的性能采样记录后再表述具体指标。 |
| Python/FastAPI/PHP | **Python/FastAPI 已实现；PHP 未实现** | FastAPI localhost sidecar 处理公开 Agent 路由，Dockerfile 安装 Python 依赖；PHP 不在项目中。 | 不得把 PHP 写入 CampusMate 技术栈。 |

## 本轮补齐目标

本轮已补齐业务可见、可演示且可测试的能力：客服流程已显式化并输出工具调用结果；原生 Function Calling 受限选择商品、本人订单和模拟工单工具；模拟人工工单按当前会话查询并由管理员队列推进状态；固定评测覆盖 6 类场景；Python FastAPI + LangGraph + Chroma 服务处理公开意图与规则检索，Node 保持个人数据工具的会话级隔离。当前 CampusMate 可以真实表述为“Node + Python 双运行时的受控 RAG Agent、LangGraph 编排、Chroma 演示向量召回、原生 Function Calling 受限工具、会话级隔离与可复现评测”。

> 本文档不是将来可以直接复制到简历的包装材料。任何未在仓库、测试与实际演示中出现的技术或指标，都不得写为已完成。
