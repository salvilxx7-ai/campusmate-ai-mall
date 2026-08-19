# CampusMate｜校园闲置流转与规则咨询系统

CampusMate 是一套全栈校园闲置商品流转与规则咨询系统。它整合商品发现、模拟订单隔离、用户发布审核、个人中心、基于公开规则的 RAG 客服、受控工具路由、管理员运营、质量检查和系统状态，并贯彻**证据优先、权限优先与可观测性优先**。

> **数据说明：** 当前商品、价格、卖家标签、图片、订单、工单与规则均为模拟数据。系统不包含真实支付、配送、资金托管、真实人工客服或真实售后裁定；规则资料只根据公开 C2C 信息改写。[1] [2] [3]

## 功能概览

| 模块 | 已实现能力 |
|---|---|
| 商品商城与发布 | 商品浏览、关键词搜索、分类筛选、详情页与学院编辑风视觉设计；登录用户可上传 1–3 张图片、填写价格和详细描述提交闲置物品审核，并在“发布管理”编辑、撤回或重新提交自己的物品。 |
| 身份与订单 | 普通用户登录与管理员授权入口、Manus OAuth 会话、模拟下单、仅本人可见的订单列表/详情和越权拒绝审计。 |
| 个人中心 | 当前会话范围内的订单轨迹、待审核/展示中/已拒绝/已撤回的闲置物品、模拟工单进度、统计摘要与本人资料编辑。 |
| RAG 客服 | Node 侧 TF-IDF 兜底检索与受控回答；Python FastAPI + LangGraph + Chroma 负责公开规则的意图路由与本地向量召回，规则回答保留引用与低置信转人工。 |
| 管理后台 | 商品状态筛选、待审核物品批量通过/拒绝、单件详情与审核历史、用户角色管理、模拟工单处理队列、规则文档生命周期与索引重建。 |
| 服务质量与系统状态 | 固定质量检查记录意图、来源、拒答和耗时；系统状态展示 Python Agent、Embedding、Chroma、规则文档和向量同步统计，并明确降级状态。 |

## 架构

```text
React 19 前端
  → tRPC 类型契约
  → Express 服务 + Manus OAuth 上下文（个人工具与 LLM 密钥）
  → localhost FastAPI + LangGraph（公开意图路由）
  → Chroma（FastEmbed ONNX 驱动的 BGE 中文预训练语义向量召回）
  → MySQL / Drizzle（商品、订单、知识、审计、质量检查）
  → Node 侧 TF-IDF 安全回退 → 受控 LLM 回答
  → 对象存储（规则文档与普通用户发布图片的受控服务端写入）
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
NODE_OPTIONS=--max-old-space-size=1280 pnpm build
```

数据库迁移位于 `drizzle/`。在受管环境中，使用已配置的数据库迁移流程同步表结构；不要提交环境变量、真实用户数据、密钥或原始录屏素材。

## 演示路径

1. 从首页或“全部商品”浏览演示目录，搜索“教材”并查看商品详情。
2. 登录后进入“发布闲置物品”，上传 1–3 张 JPEG/PNG/WebP 图片、填写价格和详细描述，提交后进入“发布管理”；可演示编辑后重新审核、撤回或对已拒绝/已撤回物品重新提交。
3. 管理员在后台按状态筛选“待审核”，选择一个或多个商品批量通过或填写原因批量拒绝；打开单件详情查看审核历史。
4. 创建一笔模拟订单并进入“我的订单”查看仅当前账户可见的记录；在 AI 客服明确请求人工后，回到个人中心查看模拟工单进度。
5. 进入 AI 客服，依次提问“什么商品不能上架？”和“星际旅行需要带什么？”，展示有引用回答与低置信转人工。
6. 在管理员后台维护规则文档，展示同步状态、版本替换、失效与批量重建入口；打开“系统状态”查看 Agent 和索引统计。
7. 打开“质量监控”，运行固定检查案例并查看实际结果；编辑个人资料，说明数据始终由当前 OAuth 会话聚合。

## 文档

| 文档 | 用途 |
|---|---|
| [`docs/product-requirements-document.md`](./docs/product-requirements-document.md) | 角色、范围、业务流程、验收标准与非功能要求。 |
| [`docs/requirements-and-architecture.md`](./docs/requirements-and-architecture.md) | 功能需求、架构选择与非功能边界。 |
| [`docs/technical-delivery-guide.md`](./docs/technical-delivery-guide.md) | 技术栈、数据模型、关键代码摘录、安全边界、测试与运行命令。 |
| [`docs/end-to-end-business-flow.md`](./docs/end-to-end-business-flow.md) | 从商品浏览、订单隔离、发布审核、AI 工具到规则索引的完整业务流。 |
| [`docs/demo-recording-script.md`](./docs/demo-recording-script.md) | 真实产品录屏的准备清单、分镜、口播与导出检查。 |
| [`docs/runtime-evidence-and-delivery-inventory.md`](./docs/runtime-evidence-and-delivery-inventory.md) | 运行证据、质量结果和前端路由清单。 |

## 测试覆盖

当前 **72 项 TypeScript 测试** 覆盖 OAuth 登出与受限登录回跳、本人资料会话归属、发布图片格式/体积校验、待审核公开隔离、发布状态机、批量审核权限与部分跳过、订单所有权、审计追加策略、RAG 回退、Function Calling 工具权限、规则同步、系统状态与审核历史；另有 **7 项 Python Agent 测试** 验证 FastAPI、LangGraph、Chroma、BGE 中文语义召回、文档幂等 upsert 与删除、公开来源限制和个人数据零接触边界。运行 `pnpm test:all` 可验证完整测试集。

## 公开规则来源

- [闲鱼社区用户服务协议](https://terms.alicdn.com/legal-agreement/terms/suit_bu1_other/suit_bu1_other201708081618_51146.html)
- [闲鱼社区交易争议处理规范](https://haibao.m.taobao.com/html/ce42wWSPf)
- [Facebook Marketplace：禁止上架的商品](https://www.facebook.com/help/130910837313345)

## 第三方参考与许可

商城业务流参考自 [Kraizan/Second-Hand](https://github.com/Kraizan/Second-Hand)（MIT License，参考提交 `dc795b3`），CampusMate 在当前 React + tRPC + MySQL 架构中重新实现。视觉建议参考 [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)（MIT License，参考提交 `8a1a6d8`）。详见 `docs/reference-marketplace-build-flow.md`。

## Release

私有仓库的 [v0.1.0-demo Release](https://github.com/salvilxx7-ai/campusmate-ai-mall/releases/tag/v0.1.0-demo) 附有从当前环境采集的无声页面演示底片；完整的真实操作与口播顺序见 `docs/demo-recording-script.md`。

[1]: https://terms.alicdn.com/legal-agreement/terms/suit_bu1_other/suit_bu1_other201708081618_51146.html "闲鱼社区用户服务协议"
[2]: https://haibao.m.taobao.com/html/ce42wWSPf "闲鱼社区交易争议处理规范"
[3]: https://www.facebook.com/help/130910837313345 "Facebook Marketplace 禁止上架的商品"
