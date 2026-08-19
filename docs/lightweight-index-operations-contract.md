# 轻量即时 Chroma 索引运维契约

## 用户确认的运行方式

本版本采用**请求内轻量重建**，而不是常驻异步队列。管理员上传、替换、失效或点击“批量重建”时，Node 在当前管理员请求内逐份执行同步，并持续写回每份文档的状态。当前单份规则文件最大 100KB，适合此模式；若未来文档数量、文件体积或重建时长显著增长，再迁移到常驻队列。

## 生命周期状态

| 维度 | 状态 | 语义 |
|---|---|---|
| 规则生命周期 | `active` | 可作为 Node TF-IDF 与 Python Chroma 的公开规则证据。 |
| 规则生命周期 | `superseded` | 已被新版本替代；保留来源、版本关系和审计，但不得再被引用。 |
| 规则生命周期 | `retired` | 管理员主动失效或删除；保留记录以解释历史操作，但不得再被引用。 |
| 向量索引 | `pending/syncing/synced/failed` | 派生索引的当前同步状态，独立于原文处理状态。 |

新版本文档会以新行保存，`supersedesDocumentId` 指向旧版本。只有新版本成功 `synced` 后，旧版本才转换为 `superseded` 并从 Chroma 删除；这样可防止同步失败时系统失去可用旧规则。

## 请求内 bootstrap

Python sidecar 启动或重启后，Chroma 内存索引只包含内置语料。Node 在首次公开规则请求前检查该运行时的 bootstrap 标记；若未完成，则读取 MySQL 中 `active + ready + synced` 的管理员公开规则，逐份发送至 localhost Python upsert 端点。过程受短超时、单文件限制和 Node TF-IDF 回退保护。

bootstrap 成功只意味着**当前 Python 运行实例**已重建；它不改变规则事实记录、生命周期或原有索引状态。部分失败时记录失败文档并继续处理其他文档，客服继续使用已加载证据或 TF-IDF 回退，而不会跳过任何个人订单权限。

## 管理操作与审计

| 操作 | Node → Python 数据 | MySQL 状态与审计 |
|---|---|---|
| 替换 | 新规则的公开正文、来源、指纹。 | 新版本先同步；成功后旧文档 `superseded`，记录替换链路和 `knowledge.version.replace` 审计。 |
| 失效/删除 | 仅 `documentId`，请求 Python 删除该文档分块。 | 标记 `retired`、记录原因/时间；写入 `knowledge.retire` 审计。 |
| 批量重建 | 每份 active 文档的公开正文、来源、指纹。 | 管理员请求内逐份重建，返回 `total/succeeded/failed`；每份同步都有审计。 |

Python 永远不接收用户、订单、工单、Cookie、OAuth/JWT、数据库凭据或 LLM 密钥。所有生命周期和权限决策只在 Node/MySQL 中进行。
