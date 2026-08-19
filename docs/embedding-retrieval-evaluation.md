# 预训练中文 Embedding 检索对比报告

**评测日期：** 2026-08-19  
**模型：** `BAAI/bge-small-zh-v1.5`，通过 FastEmbed ONNX CPU 运行时加载。  
**语料：** `python-agent/knowledge_seed.json` 中由公开 C2C 规则改写的演示文档；切分策略为 260 字符窗口、48 字符重叠。

## 方法

评测使用 5 条由现有演示规则改写得到的中文同义问题，并为每条问题标记预期来源文档。新方案使用 BGE 预训练语义向量和 Chroma cosine Top-1；基线方案使用同一语料上的旧确定性哈希向量与 cosine Top-1。执行命令如下：

```bash
CAMPUSMATE_EMBEDDING_CACHE=/tmp/campusmate-fastembed pnpm evaluate:retrieval
```

| 查询 | 预期来源 | BGE Top-1 | 哈希 Top-1 |
|---|---|---|---|
| 出售仿制品是否合规？ | 交易与上架原则 | 命中 | 命中 |
| 卖家必须说明哪些瑕疵和配件？ | 交易与上架原则 | 未命中 | 未命中 |
| 收到的二手书和商品描述不一致应该怎么处理？ | 模拟订单与售后说明 | 命中 | 未命中 |
| 签收以后是否能无理由退货？ | 模拟订单与售后说明 | 命中 | 命中 |
| 客服能够帮我查看其他同学的订单吗？ | 安全交易 FAQ | 命中 | 命中 |

| 指标 | BGE 预训练语义向量 | 旧哈希基线 |
|---|---:|---:|
| Top-1 命中 | 4 / 5 | 3 / 5 |
| Top-1 命中率 | 80% | 60% |

> 这是用于回归验证的极小演示集，不是公开 benchmark，也不代表真实用户语料上的生产准确率。它只能支持这样的结论：在本项目当前 5 条固定中文同义改写中，BGE 比旧哈希基线多命中 1 条；尚需扩充人工标注集、记录 Recall@K/MRR 和加入线上反馈才能评估真实收益。

## 运行时与失败边界

FastEmbed 的官方支持列表标明该模型为中文、512 维、MIT 许可且优化包约 0.090GB。[1] 模型加载失败、下载受限或 sidecar 未就绪时，Node 网关不会发送身份或订单数据，并回退到既有 TF-IDF 检索；Python 侧仅将哈希向量保留为维度兼容的受控最后回退。首次侧车启动发生回退是预期行为，Docker 构建期预热用于降低发布后的首次下载风险。

## 参考资料

[1] [FastEmbed 支持模型列表](https://qdrant.github.io/fastembed/examples/Supported_Models/)：`BAAI/bge-small-zh-v1.5` 的中文、512 维、MIT 和约 0.090GB 运行时信息。  
[2] [BAAI/bge-small-zh-v1.5 模型卡](https://huggingface.co/BAAI/bge-small-zh-v1.5)：模型许可与检索编码使用说明。  
