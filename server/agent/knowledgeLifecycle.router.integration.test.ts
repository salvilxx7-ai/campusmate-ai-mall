import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { knowledgeDocuments, users } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";
import { bootstrapActiveKnowledgeIntoChroma, getDb } from "../db";
import { adminRouter } from "../routers/admin";
import { answerCustomerMessage } from "./customerAgent";

afterEach(() => {
  delete process.env.CAMPUSMATE_PYTHON_AGENT;
  delete process.env.CAMPUSMATE_PYTHON_AGENT_URL;
  delete process.env.CAMPUSMATE_PYTHON_BOOTSTRAP;
});

describe("knowledge lifecycle and lightweight rebuild", () => {
  it("replaces an active rule safely, bootstraps active documents, and retires the latest version", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证规则生命周期");
    const admin = (await database.select().from(users).where(eq(users.role, "admin")).limit(1))[0];
    if (!admin) throw new Error("缺少演示管理员账户");
    const context: TrpcContext = { user: admin, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const caller = adminRouter.createCaller(context);
    const prefix = `lifecycle-seat-rule-${Date.now()}`;
    const publicSourceUrl = "https://example.edu/public-seat-rule";

    process.env.CAMPUSMATE_PYTHON_AGENT = "true";
    process.env.CAMPUSMATE_PYTHON_BOOTSTRAP = "true";
    const first = await caller.uploadKnowledgeDocument({
      fileName: `${prefix}-v1.md`,
      mimeType: "text/markdown",
      sourceType: "policy",
      publicSourceUrl,
      base64Content: Buffer.from("旧版座位预约规则：申请座位时应说明预约日期和活动名称。", "utf8").toString("base64"),
    });
    expect(first).toMatchObject({ vectorIndexStatus: "synced", version: 1 });

    const second = await caller.uploadKnowledgeDocument({
      fileName: `${prefix}-v2.md`,
      mimeType: "text/markdown",
      sourceType: "policy",
      publicSourceUrl,
      supersedesDocumentId: first.id,
      base64Content: Buffer.from("新版座位预约规则：申请座位时必须说明预约日期、活动名称、联系人和取消时限。", "utf8").toString("base64"),
    });
    expect(second).toMatchObject({ vectorIndexStatus: "synced", version: 2 });
    const oldDocument = (await database.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, first.id)).limit(1))[0];
    expect(oldDocument?.lifecycleStatus).toBe("superseded");

    const bootstrap = await bootstrapActiveKnowledgeIntoChroma();
    expect(["rebuilt", "already_current"]).toContain(bootstrap.status);
    const answer = await answerCustomerMessage({ message: "新版座位预约要写清楚哪些内容？" });
    expect(answer.citations.some(item => item.title === `${prefix}-v2`)).toBe(true);
    expect(answer.citations.some(item => item.title === `${prefix}-v1`)).toBe(false);

    const retired = await caller.retireKnowledgeDocument({ documentId: second.id, reason: "集成测试结束后失效临时新版规则" });
    expect(retired).toEqual({ documentId: second.id, status: "retired" });
    const retiredDocument = (await database.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, second.id)).limit(1))[0];
    expect(retiredDocument?.lifecycleStatus).toBe("retired");
    const afterRetire = await answerCustomerMessage({ message: "新版座位预约要写清楚哪些内容？" });
    expect(afterRetire.citations.some(item => item.title === `${prefix}-v2`)).toBe(false);

    await database.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, second.id));
    await database.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, first.id));
  }, 25_000);
});
