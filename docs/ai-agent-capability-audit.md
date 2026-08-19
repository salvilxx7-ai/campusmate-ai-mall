# CampusMate AI Agent 能力真实性审计

**审计日期：** 2026-08-19  
**审计依据：** 当前仓库的运行脚本、依赖、数据库模型、Agent/RAG 实现、路由与 Vitest 测试。

## 结论摘要

CampusMate 已实现一个可运行的、具有引用与权限边界的校园商城客服 Agent。其真实技术路线为 **React + TypeScript + Express/tRPC + MySQL/Drizzle + Python FastAPI + LangGraph + Chroma + Node 侧 TF-IDF/余弦安全回退 + 内置 LLM API**。Chroma 当前使用确定性哈希向量和受版本控制的演示语料，不能被描述为预训练语义 Embedding 系统；也没有证据支持“15 个核心页面”或“页面加载优化至 2 秒内”。

## 逐项核对

| 用户提供的陈述 | 当前 CampusMate 状态 | 真实可用表述 | 后续处理 |
|---|---|---|---|
| 清洗业务规则、售后、商品资料、FAQ | **已实现（演示范围）** | 基于公开 C2C 原则改写的规则、售后与 FAQ 演示知识文档，并支持管理员上传 Markdown/TXT 文档。 | 保留并扩展结构化来源元数据。 |
| 滑动窗口分块 | **部分实现** | Node 知识库仍采用确定性段落聚合；Python Chroma 演示语料使用 260 字符、48 字符重叠的滑动窗口。 | 将管理员文档也接入同一可配置窗口并对比召回。 |
| Embedding + Chroma 向量库 | **部分实现并已增强** | Python FastAPI 服务使用 Chroma 与确定性哈希向量完成公开规则 Top-K 召回；Node 保留 TF-IDF 回退。 | 接入预训练语义 Embedding 后才可声称语义 Embedding 检索。 |
| 带溯源 Prompt、引用、无匹配转人工 | **已实现** | 规则问答将检索证据写入受控 Prompt，页面展示公开来源；低置信问题拒答并转人工建议。 | 增加结构化工具轨迹与工单落库。 |
| LangGraph 状态流转 | **已实现（公开路由范围）** | Python sidecar 使用 LangGraph 状态图执行接收、意图分流、Chroma 检索/交还 Node 网关步骤。 | 若需多轮可恢复状态，再增加会话持久化与 checkpoint。 |
| Function Calling 商品/订单/工单工具 | **部分实现并已增强** | 商品检索与本人订单查询为服务端受控工具调用，工作流会返回结构化工具结果；登录用户可持久化仅本人可见的模拟工单。它仍不是大模型原生 Function Calling。 | 若需写原生 Function Calling，应接入支持该能力的模型工具协议并记录调用轨迹。 |
| 身份校验与越权限制 | **已实现** | OAuth 会话注入 tRPC 上下文；订单读取在服务端按用户所有权校验，拒绝请求写入追加式审计。 | 将工单访问同样按会话隔离。 |
| 15 个核心页面 | **未证实** | 当前有商城、商品、订单、客服、个人中心、后台、评测与项目说明等路由，但未以“15 个核心页面”作为验收指标。 | 仅在逐页清点并完成对应验收后再写数量。 |
| 页面加载优化至 2 秒内 | **未证实** | 已完成响应式页面与生产构建；未保存真实用户环境下的性能测量。 | 建立可复现的性能采样记录后再表述具体指标。 |
| Python/FastAPI/PHP | **Python/FastAPI 已实现；PHP 未实现** | FastAPI localhost sidecar 处理公开 Agent 路由，Dockerfile 安装 Python 依赖；PHP 不在项目中。 | 不得把 PHP 写入 CampusMate 技术栈。 |

## 本轮补齐目标

本轮已补齐业务可见、可演示且可测试的能力：客服流程已显式化并输出工具调用结果；模拟人工工单已持久化且按当前会话查询；固定评测覆盖 6 类场景；新增 Python FastAPI + LangGraph + Chroma 服务处理公开意图与规则检索，Node 保持个人数据工具的会话级隔离。当前 CampusMate 可以真实表述为“Node + Python 双运行时的受控 RAG Agent、LangGraph 编排、Chroma 演示向量召回、会话级工具隔离与可复现评测”。

> 本文档不是将来可以直接复制到简历的包装材料。任何未在仓库、测试与实际演示中出现的技术或指标，都不得写为已完成。
