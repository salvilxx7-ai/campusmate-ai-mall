# 中文预训练 Embedding 模型选型记录

**记录日期：** 2026-08-19  
**目标环境：** CampusMate 的 1 vCPU / 512 MiB WebDev 运行时；模型仅用于公开演示规则的检索，Node 侧仍保留 TF-IDF 安全回退与个人工具边界。

## 候选对比

| 候选 | 已核验特征 | 适配判断 |
|---|---|---|
| `BAAI/bge-small-zh-v1.5` | 模型卡标注为中文、MIT 许可，支持 Transformers 与 Sentence Transformers 方式加载；BGE 说明给出了查询编码与 L2 归一化的检索使用模式。 | **选用。** 面向中文检索，且 small 变体较适合受限 CPU 运行时。 |
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | 模型卡标注 Apache-2.0、50 种语言、384 维向量与约 0.1B 参数，适合通用多语种语义相似度。 | 保留为多语种备选；当前业务主要是中文规则检索，优先选择专用中文 BGE。 |

## 选型结论与约束

选择 `BAAI/bge-small-zh-v1.5` 作为本轮真实语义 Embedding 模型，并通过 **FastEmbed ONNX CPU** 运行时加载。官方仓库元数据列出约 **2,395 万** F32 参数和约 **191.7 MB** 的完整仓库存储量；FastEmbed 官方支持列表则为该模型列出 512 维中文向量和约 **0.090 GB** 的优化模型包。选择 ONNX 路径是为了避免在 512 MiB 双运行时容器中额外加载 PyTorch。模型会在 Python 服务首次启动时下载并缓存在运行时文件系统中；因此首启可能比哈希向量慢，且 autoscale 实例重建后需要重新下载或重新加载。Node 网关在 Python 超时、模型下载失败或模型运行错误时仍退回已验证的 TF-IDF 流程，不能因 Embedding 依赖不可用而放宽订单权限或输出无依据规则。

模型用于 `encode_queries` 与 `encode_passages` 两类操作，输出会归一化后写入 Chroma。其实际检索准确度将通过固定的中文同义改写查询、无关问题和来源归属案例进行对比；不会仅凭替换依赖就声称“准确率提升”。

## 参考资料

[1] [BAAI/bge-small-zh-v1.5 模型卡](https://huggingface.co/BAAI/bge-small-zh-v1.5)：中文模型标签、MIT 许可及 Transformers/Sentence Transformers 使用说明。  
[2] [sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 模型卡](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2)：Apache-2.0、50 种语言、384 维向量与本地加载方式。  
[3] [BAAI/bge-small-zh-v1.5 官方仓库元数据](https://huggingface.co/api/models/BAAI/bge-small-zh-v1.5)：模型标签、MIT 许可、约 2,395 万参数与 191,670,281 字节仓库存储量。  
[4] [FastEmbed 支持模型列表](https://qdrant.github.io/fastembed/examples/Supported_Models/)：`BAAI/bge-small-zh-v1.5` 的 ONNX CPU 支持、512 维输出、MIT 许可与约 0.090 GB 模型包。  
