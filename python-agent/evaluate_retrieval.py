"""Compare BGE semantic retrieval with the legacy deterministic-hash baseline."""

import json
from dataclasses import dataclass

from app import BASE_DIR, COLLECTION, chunk_text, encode_texts, legacy_hash_embedding


@dataclass(frozen=True)
class EvaluationCase:
    query: str
    expected_title: str


CASES = [
    EvaluationCase("出售仿制品是否合规？", "CampusMate 演示交易与上架原则"),
    EvaluationCase("卖家必须说明哪些瑕疵和配件？", "CampusMate 演示交易与上架原则"),
    EvaluationCase("收到的二手书和商品描述不一致应该怎么处理？", "CampusMate 模拟订单与售后说明"),
    EvaluationCase("签收以后是否能无理由退货？", "CampusMate 模拟订单与售后说明"),
    EvaluationCase("客服能够帮我查看其他同学的订单吗？", "CampusMate 安全交易 FAQ"),
]


def cosine(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def hash_ranked_title(query: str, corpus: list[tuple[str, str]]) -> str:
    query_vector = legacy_hash_embedding(query)
    return max(corpus, key=lambda item: cosine(query_vector, legacy_hash_embedding(item[1])))[0]


def bge_ranked_title(query: str) -> str:
    response = COLLECTION.query(query_embeddings=[encode_texts([query])[0]], n_results=1, include=["metadatas"])
    return response["metadatas"][0][0]["title"]


def main() -> None:
    raw_documents = json.loads((BASE_DIR / "knowledge_seed.json").read_text(encoding="utf-8"))
    corpus = [(document["title"], chunk) for document in raw_documents for chunk in chunk_text(document["content"])]
    bge_correct = 0
    hash_correct = 0

    print("query\texpected\tbge_top1\thash_top1")
    for case in CASES:
        bge_title = bge_ranked_title(case.query)
        hash_title = hash_ranked_title(case.query, corpus)
        bge_correct += bge_title == case.expected_title
        hash_correct += hash_title == case.expected_title
        print(f"{case.query}\t{case.expected_title}\t{bge_title}\t{hash_title}")

    total = len(CASES)
    print(f"BGE_TOP1={bge_correct}/{total} ({bge_correct / total:.0%})")
    print(f"HASH_TOP1={hash_correct}/{total} ({hash_correct / total:.0%})")


if __name__ == "__main__":
    main()
