import { afterEach, describe, expect, it, vi } from "vitest";
import { answerCustomerMessage } from "./customerAgent";

const pythonAgentUrl = "http://python-agent.test";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  delete process.env.CAMPUSMATE_PYTHON_AGENT;
  delete process.env.CAMPUSMATE_PYTHON_AGENT_URL;
  vi.unstubAllGlobals();
});

describe("Node to Python Agent gateway", () => {
  it("consumes a FastAPI policy route while forwarding only the public message", async () => {
    process.env.CAMPUSMATE_PYTHON_AGENT = "true";
    process.env.CAMPUSMATE_PYTHON_AGENT_URL = pythonAgentUrl;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).startsWith(pythonAgentUrl)) {
        expect(JSON.parse(String(init?.body))).toEqual({ message: "什么商品不能上架？" });
        return jsonResponse({
          intent: "policy_qa",
          workflow: [
            { stage: "received", detail: "FastAPI 接收公开问题。" },
            { stage: "intent_routed", detail: "LangGraph 路由意图：policy_qa。" },
            { stage: "retrieval", detail: "Chroma 返回公开规则证据。" },
          ],
          citations: [{ title: "公开规则", excerpt: "不得上架危险商品。", sourceLabel: "演示来源", sourceUrl: "https://example.com/rules", score: 0.91 }],
          handoff: false,
          runtime: "fastapi-langgraph-chroma",
        });
      }
      return jsonResponse({ choices: [{ message: { content: "依据公开规则，危险商品不能上架。" } }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerCustomerMessage({ message: "什么商品不能上架？", actor: { id: 999 } });

    expect(result.citations[0]).toMatchObject({ documentId: -1, title: "公开规则" });
    expect(result.workflow.map(step => step.detail).join(" ")).toContain("FastAPI");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps anonymous order requests at the Node boundary after Python routing", async () => {
    process.env.CAMPUSMATE_PYTHON_AGENT = "true";
    process.env.CAMPUSMATE_PYTHON_AGENT_URL = pythonAgentUrl;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url).startsWith(pythonAgentUrl)).toBe(true);
      expect(JSON.parse(String(init?.body))).toEqual({ message: "我想查询我的订单" });
      return jsonResponse({
        intent: "own_order",
        workflow: [
          { stage: "received", detail: "FastAPI 接收公开问题。" },
          { stage: "intent_routed", detail: "LangGraph 路由意图：own_order。" },
          { stage: "retrieval", detail: "不访问 Python 中的个人数据。" },
        ],
        citations: [],
        handoff: false,
        runtime: "fastapi-langgraph-chroma",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerCustomerMessage({ message: "我想查询我的订单" });

    expect(result.requiresLogin).toBe(true);
    expect(result.answer).toContain("需要先登录");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
