from fastapi.testclient import TestClient

import app as agent_app
from app import app

client = TestClient(app)


def test_health_exposes_real_runtime_and_seeded_chroma_collection():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["runtime"] == "fastapi-langgraph-chroma"
    assert body["knowledgeChunkCount"] > 3
    assert body["embeddingModel"] == "BAAI/bge-small-zh-v1.5"
    assert body["embeddingBackend"] == "fastembed-bge"
    assert body["embeddingDimension"] == 512


def test_policy_question_uses_langgraph_and_returns_chroma_citations():
    response = client.post("/v1/route", json={"message": "什么商品不能上架？"})
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "policy_qa"
    assert body["citations"]
    assert body["embeddingBackend"] == "fastembed-bge"
    assert [step["stage"] for step in body["workflow"]] == ["received", "intent_routed", "retrieval"]


def test_semantic_chinese_paraphrase_recalls_listing_policy_without_exact_phrase_match():
    response = client.post("/v1/route", json={"message": "出售仿制品是否合规？"})
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "policy_qa"
    assert body["citations"]
    assert body["citations"][0]["title"] == "CampusMate 演示交易与上架原则"


def test_pretrained_model_unavailable_uses_dimension_compatible_controlled_fallback():
    original_embedder = agent_app.EMBEDDER
    try:
        agent_app.EMBEDDER = None
        vector = agent_app.encode_texts(["模型暂不可用时仍应安全回退"])[0]
        assert len(vector) == 512
        assert any(vector)
    finally:
        agent_app.EMBEDDER = original_embedder


def test_order_intent_does_not_receive_or_query_personal_data():
    response = client.post("/v1/route", json={"message": "我想查询我的订单"})
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "own_order"
    assert body["citations"] == []
    assert "不访问 Python 中的个人数据" in body["workflow"][-1]["detail"]


if __name__ == "__main__":
    test_health_exposes_real_runtime_and_seeded_chroma_collection()
    test_policy_question_uses_langgraph_and_returns_chroma_citations()
    test_semantic_chinese_paraphrase_recalls_listing_policy_without_exact_phrase_match()
    test_pretrained_model_unavailable_uses_dimension_compatible_controlled_fallback()
    test_order_intent_does_not_receive_or_query_personal_data()
    print("python-agent tests passed")
