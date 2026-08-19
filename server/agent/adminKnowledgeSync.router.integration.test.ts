import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { knowledgeDocuments, users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { adminRouter } from "../routers/admin";
import { answerCustomerMessage } from "./customerAgent";

afterEach(() => {
  delete process.env.CAMPUSMATE_PYTHON_AGENT;
  delete process.env.CAMPUSMATE_PYTHON_AGENT_URL;
});

describe("admin router knowledge-to-Chroma flow", () => {
  it("uploads, retries, persists vector state, and makes the public rule citable through Node customer service", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证管理员同步路由");
    const admin = (await database.select().from(users).where(eq(users.role, "admin")).limit(1))[0];
    if (!admin) throw new Error("缺少演示管理员账户");
    const context: TrpcContext = { user: admin, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = adminRouter.createCaller(context);
    const title = `router-ticket-rule-${Date.now()}`;
    const content = "校园演讲活动票券规则：发布票券时必须说明票券名称、实名限制、是否允许转让和线下交付方式；不得发布来源不明的票券。";

    process.env.CAMPUSMATE_PYTHON_AGENT = "false";
    const uploaded = await caller.uploadKnowledgeDocument({
      fileName: `${title}.md`,
      mimeType: "text/markdown",
      sourceType: "policy",
      publicSourceUrl: "https://example.edu/public-event-ticket-rule",
      base64Content: Buffer.from(content, "utf8").toString("base64"),
    });
    expect(uploaded.vectorIndexStatus).toBe("failed");

    process.env.CAMPUSMATE_PYTHON_AGENT = "true";
    const retried = await caller.retryKnowledgeVectorSync({ documentId: uploaded.id });
    expect(retried).toMatchObject({ documentId: uploaded.id, status: "synced" });
    const persisted = (await database.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, uploaded.id)).limit(1))[0];
    expect(persisted).toMatchObject({ vectorIndexStatus: "synced" });
    expect(persisted?.vectorIndexVersion).toContain("bge-small-zh-v1.5");

    const response = await answerCustomerMessage({ message: "演讲活动票券发布时要写清楚哪些限制？" });
    expect(response.citations.some(item => item.title === title)).toBe(true);

    await database.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, uploaded.id));
  }, 20_000);
});
