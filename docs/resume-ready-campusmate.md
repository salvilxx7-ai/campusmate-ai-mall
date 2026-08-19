# CampusMate｜简历可用项目表述（基于已验证实现）

> 使用前提：以下表述只对应当前仓库中已经运行、测试或记录过的能力。当前可以写 Python、FastAPI、LangGraph、Chroma 与预训练中文语义 Embedding；但不能写 PHP、15 个核心页面或“页面加载 2 秒内”，因为这些尚未完成对应实现或测量。

## 一行项目定位

**CampusMate 校园二手商城与可溯源 AI 客服**｜面向校园二手交易的 Node + Python 双运行时作品集项目，将模拟订单隔离、基于公开规则的 RAG 客服、受控工具调用、模拟人工工单与可复现评测整合为可讲解的 AI 应用工程闭环。

## 技术栈

**React 19、TypeScript、Vite、Tailwind CSS、Express 4、tRPC 11、Drizzle ORM、MySQL/TiDB、Manus OAuth、Python、FastAPI、LangGraph、Chroma、FastEmbed ONNX、BAAI/bge-small-zh-v1.5、TF-IDF/余弦安全回退、内置 LLM API、对象存储、Vitest。**

## 简历项目经历版本

**CampusMate 校园二手商城与可溯源 AI 客服｜个人作品集项目**

- 设计并实现校园二手商城前台、模拟下单、个人订单/个人中心与管理员后台；通过 Manus OAuth 和服务端 tRPC 过程按当前会话限定订单、发布物品与工单查询，越权订单读取会被拒绝并写入追加式审计日志。
- 构建公开 C2C 规则改写的演示知识库，支持 Markdown/TXT 文档上传、Python FastAPI + Chroma + FastEmbed ONNX 的 `BAAI/bge-small-zh-v1.5` 预训练中文语义 Top-K 召回，以及 Node 侧 TF-IDF/余弦安全回退；固定 5 题同义改写集的 Top-1 从哈希基线 3/5 提升至 BGE 4/5，不外推为生产准确率。
- 使用 LangGraph 实现“接收问题—意图分流—公开规则检索/业务网关”状态图；FastAPI 只接收公开问题，Node 网关保留 OAuth 会话、LLM 密钥与商品/本人订单/工单工具，避免跨服务复制个人数据权限。
- 新增模拟人工工单闭环：登录用户可保存转人工上下文、回答摘要与工作流轨迹，并只查询本人记录；固定评测覆盖规则、无匹配、商品、本人订单、跨账户订单与人工转接 6 类场景。实现管理员 HTTPS 公开规则上传后的 Chroma 增量同步、状态/错误/重试、`active/superseded/retired` 生命周期、替换安全顺序、运行时 bootstrap 与同步批量重建；当前 42 项 TypeScript 测试与 7 项 Python Agent 测试通过。

## 面试时的诚实说明

当前版本已使用 **Python FastAPI + LangGraph + Chroma + FastEmbed ONNX**：Python 服务以 localhost sidecar 形式处理公开意图与规则检索，Chroma 使用受版本控制演示语料和 `BAAI/bge-small-zh-v1.5` 的 512 维预训练中文语义向量；Node 侧继续保留 TF-IDF 安全回退、OAuth、个人数据工具和 LLM 密钥。管理员上传文档会增量同步至 Chroma，且首次公开规则请求会将当前 `active + ready + synced` 规则 bootstrap 到该 Python 运行实例；Chroma 仍是容器本地派生索引，不是跨容器持久事实源，也不是大模型原生 Function Calling。

## 差距补齐优先级

| 优先级 | 工作项 | 产出与验收标准 | 完成后可新增的真实表述 |
|---|---|---|---|
| P0 | 增加规则版本历史查看 UI，并采集文档数量、耗时与冷启动容量基准。 | 可查看替换链路；保留不同规模下的 bootstrap/批量重建原始采样。 | 能以实测容量边界说明轻量同步模式的适用范围。 |
| P1 | 用浏览器真实设备与网络条件采集 Web Vitals。 | 保留 Lighthouse/Performance 原始报告与采样脚本。 | 仅依据报告写加载或交互性能指标。 |
| P2 | 为工单补充管理员处理队列、状态变更和通知模拟。 | 状态流转权限测试、审计与可视化队列。 | 工单提交与处理闭环。 |

> 不建议为了让项目“看起来像大厂项目”而写入未实现技术。对 2027 届 AI 应用岗位而言，能够讲清楚证据边界、权限边界、失败兜底和迭代路线，通常比堆叠技术名词更能经得起追问。
