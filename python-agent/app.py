from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Annotated, Literal, TypedDict

import chromadb
from fastapi import FastAPI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
VECTOR_DIMENSION = 96
TOP_K = 3
GROUNDING_THRESHOLD = 0.18


class RouteRequest(BaseModel):
    message: str = Field(min_length=2, max_length=500)


class WorkflowStep(BaseModel):
    stage: Literal["received", "intent_routed", "retrieval", "handoff_ready"]
    detail: str


class Citation(BaseModel):
    title: str
    excerpt: str
    sourceLabel: str
    sourceUrl: str
    score: float


class RouteResponse(BaseModel):
    intent: Literal["policy_qa", "product_search", "own_order", "human_handoff"]
    workflow: list[WorkflowStep]
    citations: list[Citation]
    handoff: bool
    runtime: Literal["fastapi-langgraph-chroma"] = "fastapi-langgraph-chroma"


class AgentState(TypedDict, total=False):
    message: str
    intent: Literal["policy_qa", "product_search", "own_order", "human_handoff"]
    workflow: list[dict[str, str]]
    citations: list[dict[str, object]]
    handoff: bool


def hash_embedding(text: str) -> list[float]:
    """Deterministic local embedding for demo-only Chroma retrieval; not a semantic model."""
    values = [0.0] * VECTOR_DIMENSION
    normalized = "".join(text.lower().split())
    tokens = [normalized[index : index + 2] for index in range(max(0, len(normalized) - 1))]
    if not tokens and normalized:
        tokens = [normalized]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:4], "big") % VECTOR_DIMENSION
        values[bucket] += 1.0
    magnitude = math.sqrt(sum(value * value for value in values))
    return [round(value / magnitude, 8) for value in values] if magnitude else values


def chunk_text(content: str, size: int = 260, overlap: int = 48) -> list[str]:
    normalized = "\n\n".join(block.strip() for block in content.split("\n\n") if block.strip())
    if len(normalized) <= size:
        return [normalized]
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + size)
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(normalized):
            break
        start = max(end - overlap, start + 1)
    return chunks


def classify(message: str) -> Literal["policy_qa", "product_search", "own_order", "human_handoff"]:
    normalized = message.lower()
    if any(token in normalized for token in ("人工", "真人", "投诉", "转接", "客服专员")):
        return "human_handoff"
    if any(token in normalized for token in ("订单", "订单号", "下单", "我的订单", "取货码")):
        return "own_order"
    if any(token in normalized for token in ("规则", "上架", "禁止", "售后", "退货", "退款", "纠纷", "签收", "描述不符", "安全吗")):
        return "policy_qa"
    if any(token in normalized for token in ("商品", "相机", "耳机", "教材", "阅读灯", "收纳", "瑜伽", "有没有")):
        return "product_search"
    return "policy_qa"


def build_collection():
    client = chromadb.EphemeralClient()
    collection = client.get_or_create_collection(name="campusmate_public_demo_knowledge", metadata={"hnsw:space": "cosine"})
    documents = json.loads((BASE_DIR / "knowledge_seed.json").read_text(encoding="utf-8"))
    ids: list[str] = []
    texts: list[str] = []
    metadatas: list[dict[str, str]] = []
    embeddings: list[list[float]] = []
    for document_index, document in enumerate(documents):
        for chunk_index, content in enumerate(chunk_text(document["content"])):
            ids.append(f"doc-{document_index}-chunk-{chunk_index}")
            texts.append(content)
            metadatas.append({
                "title": document["title"],
                "sourceLabel": document["sourceLabel"],
                "sourceUrl": document["sourceUrl"],
            })
            embeddings.append(hash_embedding(content))
    collection.add(ids=ids, documents=texts, metadatas=metadatas, embeddings=embeddings)
    return collection


COLLECTION = build_collection()
app = FastAPI(title="CampusMate Python Agent", version="0.1.0")


def add_received(state: AgentState) -> AgentState:
    return {"workflow": [{"stage": "received", "detail": "FastAPI 接收公开问题；请求未携带用户身份或订单数据。"}]}


def route_intent(state: AgentState) -> AgentState:
    intent = classify(state["message"])
    workflow = state.get("workflow", []) + [{"stage": "intent_routed", "detail": f"LangGraph 路由意图：{intent}。"}]
    return {"intent": intent, "workflow": workflow}


def route_after_intent(state: AgentState) -> str:
    return "retrieve" if state["intent"] == "policy_qa" else "handoff_or_tool"


def retrieve_policy(state: AgentState) -> AgentState:
    result = COLLECTION.query(query_embeddings=[hash_embedding(state["message"])], n_results=TOP_K, include=["documents", "metadatas", "distances"])
    citations: list[dict[str, object]] = []
    documents = result.get("documents", [[]])[0] or []
    metadatas = result.get("metadatas", [[]])[0] or []
    distances = result.get("distances", [[]])[0] or []
    for content, metadata, distance in zip(documents, metadatas, distances):
        score = round(max(0.0, 1.0 - float(distance)), 4)
        if score >= GROUNDING_THRESHOLD:
            citations.append({
                "title": metadata["title"],
                "excerpt": content[:240],
                "sourceLabel": metadata["sourceLabel"],
                "sourceUrl": metadata["sourceUrl"],
                "score": score,
            })
    workflow = state.get("workflow", []) + [{
        "stage": "retrieval",
        "detail": f"Chroma 使用本地确定性哈希向量召回 {len(citations)} 条超过阈值的公开演示证据。",
    }]
    if not citations:
        workflow.append({"stage": "handoff_ready", "detail": "检索证据不足，要求业务网关走安全转人工分支。"})
    return {"citations": citations, "workflow": workflow, "handoff": not bool(citations)}


def handoff_or_tool(state: AgentState) -> AgentState:
    workflow = state.get("workflow", [])
    if state["intent"] == "human_handoff":
        workflow = workflow + [{"stage": "handoff_ready", "detail": "用户主动请求人工支持；Node 网关可在登录后创建模拟工单。"}]
        return {"workflow": workflow, "handoff": True, "citations": []}
    workflow = workflow + [{"stage": "retrieval", "detail": "该意图不访问 Python 中的个人数据；由 Node 网关在 OAuth 校验后执行受控业务工具。"}]
    return {"workflow": workflow, "handoff": False, "citations": []}


graph = StateGraph(AgentState)
graph.add_node("received", add_received)
graph.add_node("route", route_intent)
graph.add_node("retrieve", retrieve_policy)
graph.add_node("handoff_or_tool", handoff_or_tool)
graph.add_edge(START, "received")
graph.add_edge("received", "route")
graph.add_conditional_edges("route", route_after_intent, {"retrieve": "retrieve", "handoff_or_tool": "handoff_or_tool"})
graph.add_edge("retrieve", END)
graph.add_edge("handoff_or_tool", END)
agent_graph = graph.compile()


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "runtime": "fastapi-langgraph-chroma", "knowledgeChunkCount": COLLECTION.count()}


@app.post("/v1/route", response_model=RouteResponse)
def route_message(request: RouteRequest) -> RouteResponse:
    result = agent_graph.invoke({"message": request.message})
    return RouteResponse(
        intent=result["intent"],
        workflow=[WorkflowStep(**step) for step in result.get("workflow", [])],
        citations=[Citation(**citation) for citation in result.get("citations", [])],
        handoff=bool(result.get("handoff", False)),
    )
