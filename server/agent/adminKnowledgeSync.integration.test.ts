import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { knowledgeDocuments, users } from "../../drizzle/schema";
import { getDb, syncKnowledgeDocumentToChroma, uploadKnowledgeDocument } from "../db";
import { answerCustomerMessage } from "./customerAgent";

afterEach(() => {
  delete process.env.CAMPUSMATE_PYTHON_AGENT;
  delete process.env.CAMPUSMATE_PYTHON_AGENT_URL;
});

describe("administrator document-to-Chroma sync", () => {
  it("persists failed then synced state and makes a newly uploaded public rule retrievable", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证知识库同步");
    const owner = (await database.select().from(users).where(eq(users.role, "admin")).limit(1))[0];
    if (!owner) throw new Error("缺少演示管理员账户");

    process.env.CAMPUSMATE_PYTHON_AGENT = "false";
    const content = "校园活动票券补充演示规则：发布票券时必须说明是否实名、是否可转让、交付方式和已知限制；来源不明的票券不得发布。";
    const uploaded = await uploadKnowledgeDocument({
      actorUserId: owner.id,
      fileName: `ticket-rule-sync-${Date.now()}.md`,
      mimeType: "text/markdown",
      sourceType: "policy",
      publicSourceUrl: "https://example.edu/public-ticket-rule",
      base64Content: Buffer.from(content, "utf8").toString("base64"),
    });

    expect(uploaded.vectorIndexStatus).toBe("failed");
    const failed = (await database.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, uploaded.id)).limit(1))[0];
    expect(failed?.vectorIndexStatus).toBe("failed");
    expect(failed?.vectorIndexError).toContain("Python Chroma");

    process.env.CAMPUSMATE_PYTHON_AGENT = "true";
    const synced = await syncKnowledgeDocumentToChroma({ documentId: uploaded.id, actorUserId: owner.id });
    expect(synced).toMatchObject({ documentId: uploaded.id, status: "synced" });
    const persisted = (await database.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, uploaded.id)).limit(1))[0];
    expect(persisted).toMatchObject({ vectorIndexStatus: "synced" });
    expect(persisted?.vectorIndexVersion).toContain("bge-small-zh-v1.5");
    expect(persisted?.contentFingerprint).toHaveLength(64);

    const response = await answerCustomerMessage({ message: "活动票券发布时要写清楚什么？" });
    expect(response.citations.some(item => item.title === uploaded.title)).toBe(true);
    await database.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, uploaded.id));
  }, 20_000);
});
