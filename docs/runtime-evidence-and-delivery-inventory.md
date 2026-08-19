# CampusMate｜运行证据与前端交付清单

> **记录日期：** 2026-08-19。本文保存本轮可复查的运行证据，不把开发环境结果包装为生产 SLA 或真实客服运营数据。

## 1. 原生 Function Calling 运行证据

| 项目 | 记录值 |
|---|---|
| 请求模型 | `gpt-5-nano` |
| 用户问题 | “有没有二手教材？” |
| 强制工具 | `search_catalog` |
| 参数协议 | JSON Schema：`{ query: string }`，禁止额外字段。 |
| 实际响应 | `finish_reason: "stop"`，返回 `tool_calls[0].function.name = "search_catalog"`，参数为 `{"query":"二手教材"}`。 |
| 响应标识 | `resp_067ca47dccb21c53006a8596e66f7081a28799ba90accce804` |
| 服务端执行边界 | 模型不接触用户 ID、Cookie、订单、数据库或密钥；Node 在执行前重新验证 JSON 参数、OAuth 会话和显式人工请求。 |

首次探测使用 GPT-5 的 `max_tokens` 参数时只获得推理输出而没有工具调用。随后将封装扩展为 `max_completion_tokens`，以为推理与函数参数预留完成空间；以上响应来自修复后的最小化真实请求。这说明功能协议可用，但不代表所有模型、所有提示词或所有网络条件下的成功率。

## 2. 结构化测量记录

| 流程 | 记录来源 | `selectedTool` | `outcome` | `authorization` | `latencyMs` | 解释 |
|---|---|---|---|---|---:|---|
| 目录原生工具选择 | 最小真实运行脚本 | `search_catalog` | `success` | `allowed` | 6469.44 | `gpt-5-nano` 为“有没有二手教材？”返回工具参数后，由 Node 测量完整选择耗时。 |
| 未登录本人订单 | `nativeToolCalling.test.ts` | `fallback` | `fallback` | `blocked` | 断言字段存在 | 模型即使选择 `own_order_lookup`，未登录状态也不能获得该工具。 |
| 未登录人工工单 | `nativeToolCalling.test.ts` | `fallback` | `fallback` | `blocked` | 断言字段存在 | 未登录用户不能以模型工具绕过模拟工单创建门槛。 |
| 未选择工具回退 | `nativeToolCalling.test.ts` | `fallback` | `fallback` | `not_required` | 断言字段存在 | 规则问题未返回工具调用时，客服可安全交还既有确定性/Python 路由。 |
| 管理员工单状态更新 | 最小真实运行脚本 | `admin_ticket_status_update` | `success` | `allowed` | 162.44 | 对新建模拟工单执行 `open → in_review`；服务端返回请求内状态变更耗时。 |

管理员队列的每次 `open / in_review / resolved` 状态处理都会在服务端返回 `latencyMs`，并在管理台成功提示中展示。集成测试创建模拟工单后执行状态转移，断言状态已更新且耗时为非负数；该数据用于确认请求内处理有可观察结果，不是吞吐量或生产 SLA。

## 3. 固定检索质量运行证据

当前评测页从 3 份既有公开 C2C 规则改写文档中构建固定 6 题集，使用当前 Node 侧 TF-IDF/余弦检索，计算文档级 Recall@3 和 MRR。一次页面运行结果为：**Recall@3 100%、MRR 92%、平均检索时间 2.13 ms**。

这些数字只描述当前小规模演示语料、当前机器和确定性检索器。它们不代表 FastEmbed/Chroma 的线上召回、真实用户提问效果、并发能力或生产延迟。评测页会在每次加载时重新计算；单元测试固定验证 6 个问题、每题均能召回预期文档、Recall@3 不低于 80%、MRR 不低于 70%。

## 4. 前端交付与真实性边界

| 路由 | 已交付界面与业务目的 |
|---|---|
| `/` | 学院编辑风首页、商品发现与客服入口。 |
| `/goods`、`/goods/:id` | 商品目录、筛选搜索与演示商品详情。 |
| `/orders`、`/orders/:id` | 当前会话范围内的模拟订单列表和详情。 |
| `/customer-service` | RAG 客服、引用、工具轨迹、人工转接与我的模拟工单。 |
| `/profile` | 本人资料、订单轨迹与发布物品状态。 |
| `/login` | 普通用户注册/登录与管理员授权入口。 |
| `/admin` | 商品、用户角色、模拟工单、知识库与索引管理。 |
| `/evaluation` | 固定 Agent 评测与固定检索质量评测。 |
| `/project-guide` | 架构、真实性边界与面试深挖说明。 |

此清单用于展示已交付路由，**不将动态详情页或管理模块重复计数为“15 个核心页面”**。当前仅完成生产构建验证，尚未在受控设备/网络条件下采集 Lighthouse 或 Web Vitals，因此**不得写“页面加载优化至 2 秒内”**。
