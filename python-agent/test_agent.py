from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health_exposes_real_runtime_and_seeded_chroma_collection():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["runtime"] == "fastapi-langgraph-chroma"
    assert body["knowledgeChunkCount"] > 3


def test_policy_question_uses_langgraph_and_returns_chroma_citations():
    response = client.post("/v1/route", json={"message": "什么商品不能上架？"})
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "policy_qa"
    assert body["citations"]
    assert [step["stage"] for step in body["workflow"]] == ["received", "intent_routed", "retrieval"]


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
    test_order_intent_does_not_receive_or_query_personal_data()
    print("python-agent tests passed")
