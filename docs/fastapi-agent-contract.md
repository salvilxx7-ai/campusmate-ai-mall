# FastAPI + LangGraph + Chroma Agent 服务契约

**状态：** 已验证（开发环境）。Python Agent 已通过 FastAPI 测试、LangGraph/Chroma 离线测试以及 Node → localhost FastAPI 的公开规则与匿名订单边界请求验证；生产镜像已配置 Python 依赖，但仍需首次发布构建日志验证。

## 1. 分层职责

| 层 | 运行时 | 负责内容 | 不负责内容 |
|---|---|---|---|
| 浏览器 | React/TypeScript | 提交消息、展示引用/工作流/工具结果。 | 不决定用户身份、不访问 Python 内部端口、不调用订单工具。 |
| 业务网关 | Node.js + Express/tRPC | 验证 OAuth 会话、执行商品/订单/工单工具、保存审计、持有 LLM 密钥。 | 不把客户端提供的用户 ID 转发为可信身份。 |
| Agent 编排与检索 | Python + FastAPI + LangGraph + Chroma | 意图路由、规则检索、返回显式 LangGraph 轨迹和可引用证据。 | 不读取会话 Cookie、不直接连接订单/工单数据库、不执行个人数据工具。 |

## 2. Python 服务请求契约

Python 服务只在 `127.0.0.1` 上监听，Node 通过内部 HTTP 调用。请求中**不得出现**用户 ID、角色、Cookie、JWT、订单详情、数据库凭据或 LLM 密钥。

```json
POST /v1/route
{
  "message": "什么商品不能上架？"
}
```

```json
{
  "intent": "policy_qa",
  "workflow": [
    {"stage": "received", "detail": "..."},
    {"stage": "intent_routed", "detail": "..."},
    {"stage": "retrieval", "detail": "..."}
  ],
  "citations": [
    {"title": "...", "excerpt": "...", "sourceLabel": "...", "sourceUrl": "...", "score": 0.0}
  ],
  "handoff": false,
  "runtime": "fastapi-langgraph-chroma"
}
```

对于 `product_search`、`own_order` 和 `human_handoff` 意图，Python 仅返回路由结果；Node 仍在完成认证后执行受控工具。这样 LangGraph 参与编排，但不会获得个人业务数据或越权能力。

## 3. 知识与模型边界

Chroma 在本阶段仅存放由公开 C2C 规则改写的**演示知识库**，通过 FastEmbed ONNX CPU 使用 `BAAI/bge-small-zh-v1.5` 的 512 维预训练中文语义向量完成本地向量检索。Node 保留 TF-IDF 作为启动、下载或模型加载失败时的受控回退。管理员上传的 HTTPS 公开规则会增量同步至 Chroma；规则以 `active/superseded/retired` 生命周期控制引用资格，新版本先完成同步、旧版本后失效。每个新的 Python 运行实例在首次公开规则请求前，由 Node bootstrap 当前 `active + ready + synced` 文档。受控回答继续由 Node 侧的内置 LLM 客户端生成，保证密钥仅保留在现有服务端信任边界。

## 4. 已预期问题与应对

| 风险 | 为什么会出现 | 应对方案 | 面试应答重点 |
|---|---|---|---|
| WebDev 默认镜像没有 Python | 当前项目原本是 Node 单运行时。 | 使用自定义 Dockerfile 安装 Python 与 requirements；本地开发由 Node 管理子进程。 | 多运行时部署需要明确构建、健康检查与退出清理。 |
| Chroma 容器存储易失 | Autoscale 容器的本地文件系统不是持久数据源。 | Node 在新的 `runtimeInstanceId` 首次接收公开规则请求前，逐份 bootstrap `active + ready + synced` 文档；MySQL/对象存储仍是事实源。 | 向量库不能被当作唯一数据源；bootstrap 成功只代表当前运行实例已恢复。 |
| 跨服务泄露身份 | 若浏览器直接调用 Python，攻击者可伪造用户 ID。 | Python 只监听 localhost；Node 认证后才执行任何个人数据工具。 | 最小权限：编排服务不拥有订单权限。 |
| Python 服务启动晚于 Node 或 BGE 需要下载 | 首个请求可能遇到 sidecar 尚未就绪或模型缓存缺失。 | 公开客服使用 1.8 秒超时和 TF-IDF 安全 fallback；管理员索引写入使用独立的受控冷启动重试窗口；Docker 构建期执行 BGE 预热。 | 依赖不可用时系统应退化而非泄露或阻塞订单能力；管理写入与公开问答不应共用相同超时策略。 |
| BGE sidecar 与 Node 构建竞争内存 | 开发环境中并发运行 sidecar 与 Vite 构建曾导致构建退出码 143。 | 生产构建前停止可按需重启的 sidecar，并以 `NODE_OPTIONS=--max-old-space-size=1280` 构建成功；部署后应监控内存并考虑将 Embedding 拆分至独立运行时。 | 模型引入不仅是检索精度变化，也是容量规划问题。 |
| LLM 密钥被多运行时复制 | 把 Forge key 放到 Python 服务会扩大暴露面。 | Python 不调用 LLM，Node 保留现有受控 LLM 网关。 | 密钥与个人工具都放在最小必要边界。 |

## 5. 自动化验证证据

```bash
pnpm test:all
pnpm check
```

当前结果为 **63 项 TypeScript 测试与 7 项 Python Agent 测试通过**。其中 `server/agent/pythonAgentGateway.integration.test.ts` 通过 mock FastAPI 地址验证两条跨服务契约：第一，Node 仅向 Python 发送 `{ message }`，并消费 LangGraph/Chroma 返回的公开证据；第二，匿名订单意图即使已被 Python 路由，仍由 Node 保持登录门槛，不会向 Python 发送身份或订单数据。`knowledgeLifecycle.router.integration.test.ts` 进一步覆盖“新版本先同步、旧版本 supersede、运行时 bootstrap、失效删除后不再引用”的端到端链路；`auth.oauthReturnPath.test.ts` 验证 OAuth 回调不能被外部跳转目标利用。原生工具调用的成功/拒绝/回退测量、资料编辑、用户发布图片策略、角色管理、工单队列与固定检索质量测试均停留在 Node/tRPC 与 MySQL 边界，绝不向 Python 转发身份字段、角色变更或工单处理数据。
