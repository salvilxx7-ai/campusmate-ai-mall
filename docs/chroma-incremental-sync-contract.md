# 管理员知识文档增量 Chroma 同步契约

## 目标

管理员上传一份**带公开来源 URL 的演示规则文档**后，系统应先保存对象存储与 MySQL 中的文档/分块事实记录，再把不含用户身份和密钥的公开规则内容增量写入 Python Agent 的 Chroma 集合。成功后，新规则可以在当前 FastAPI 运行实例中立刻被客服检索并返回来源；失败时文档保留为可见的 `failed` 索引状态，管理员可以安全重试。

## 数据与信任边界

| 边界 | 允许数据 | 明确禁止 |
|---|---|---|
| 浏览器 → Node 管理路由 | 文件名、文件正文、规则分类、公开来源 URL。 | 用户 ID、角色或索引状态由浏览器决定。 |
| Node → MySQL / 对象存储 | 受管理员过程校验后的元数据、文件内容、分块、指纹、索引状态和审计事件。 | 以客户端指定的文档 ID 读写其他资源。 |
| Node → FastAPI localhost | `documentId`、标题、来源标签/URL、公开规则正文、SHA-256 内容指纹。 | Cookie、OAuth/JWT、用户身份、订单/工单数据、数据库凭据、LLM 密钥。 |
| FastAPI → Chroma | 用 BGE 编码后的公开规则分块与来源元数据。 | 任何个人业务数据或未经来源声明的文件。 |

## 索引状态机与幂等性

`knowledgeDocuments` 将记录 `vectorIndexStatus`、`vectorIndexVersion`、`vectorIndexError`、`vectorIndexedAt` 与 `contentFingerprint`。状态遵循以下顺序：`pending → syncing → synced`；任何网络、模型或 Chroma 异常进入 `failed` 并保留错误摘要。重试只允许管理员操作，并将同一 `documentId + chunkIndex + contentFingerprint` 作为 Chroma upsert 键，因此不会产生重复分块。

> 文档只有在 MySQL 分块已写入、来源 URL 为安全的 `https:` 地址、并且 Node 成功收到 Python 的 upsert 回执后才显示为 `synced`。上传成功但索引失败绝不伪装为“已生效”。

## 请求与响应契约

```json
POST /v1/index/documents
{
  "documentId": 42,
  "title": "校园二手交易补充规则",
  "sourceLabel": "管理员上传｜校园二手交易补充规则",
  "sourceUrl": "https://example.edu/public-rule",
  "content": "公开规则正文……",
  "contentFingerprint": "sha256-hex"
}
```

Python 服务使用与检索相同的 260/48 窗口及 `BAAI/bge-small-zh-v1.5`，以固定 ID 执行 Chroma `upsert`。响应包括分块数量、当前集合数量、Embedding 后端与索引版本。Node 依据响应更新状态并写入追加式审计。

## 运行时限制与恢复

当前 Chroma 运行在 Python sidecar 的容器本地路径；它不是 MySQL/对象存储的事实源。容器重建后需要从 MySQL 中 `synced` 的公开规则重新入库。当前版本提供管理员手动“重试/同步”入口，并在管理员页面说明本地索引的运行时范围；后续可加入启动 bootstrap 或队列化重建任务。

当 Python sidecar 未就绪、BGE 下载失败或索引调用超时时，Node 将文档标记为 `failed`，保留 Node TF-IDF 检索与既有规则服务，不会把索引失败转换为个人数据调用或无依据回答。
