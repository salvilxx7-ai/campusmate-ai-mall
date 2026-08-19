import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key: `test/${key}`, url: `/manus-storage/test/${key}` })),
  storageGetSignedUrl: vi.fn(),
}));

vi.mock("./agent/pythonAgentGateway", () => ({
  getPythonAgentHealth: vi.fn(async () => ({ status: "ok", runtime: "fastapi-langgraph-chroma", knowledgeChunkCount: 12, embeddingModel: "BAAI/bge-small-zh-v1.5", embeddingBackend: "fastembed-bge", embeddingDimension: 512, indexVersion: "test-index-v1", runtimeInstanceId: "test-runtime" })),
  indexPublicKnowledgeDocument: vi.fn(),
  removePublicKnowledgeDocument: vi.fn(),
}));

import { auditLogs, categories, products, users } from "../drizzle/schema";
import { batchReviewProducts, createUserListing, getAdminProductReviewDetail, getAdminSystemStatus, getDb } from "./db";

describe("administrator observability", () => {
  let createdProductId: number | undefined;

  afterEach(async () => {
    if (!createdProductId) return;
    const database = await getDb();
    await database?.delete(auditLogs).where(and(eq(auditLogs.resourceType, "product"), eq(auditLogs.resourceId, String(createdProductId))));
    await database?.delete(products).where(eq(products.id, createdProductId));
    createdProductId = undefined;
  });

  it("summarizes agent and knowledge state without exposing private runtime credentials", async () => {
    const status = await getAdminSystemStatus();
    expect(status.agent).toMatchObject({ available: true, runtime: "fastapi-langgraph-chroma", embeddingDimension: 512, indexVersion: "test-index-v1" });
    expect(status.knowledge.databaseAvailable).toBe(true);
    expect(status.knowledge.documentCount).toBeGreaterThan(0);
    expect(Object.keys(status.agent)).not.toContain("apiKey");
  });

  it("returns product imagery and review history while omitting seller email from the administrator detail contract", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用");
    const [actor] = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
    const [category] = await database.select().from(categories).limit(1);
    if (!actor || !category) throw new Error("缺少管理员或分类");
    const created = await createUserListing({ userId: actor.id, categoryId: category.id, title: `审核详情测试-${Date.now()}`, description: "用于验证管理员审核详情图片、发布者上下文与追加式审核历史的详细描述。", priceCents: 6100, condition: "excellent", images: [{ name: "detail.png", dataUrl: `data:image/png;base64,${Buffer.from("detail-image").toString("base64")}` }] });
    if (!created) throw new Error("测试商品创建失败");
    createdProductId = created.product.id;
    await batchReviewProducts({ actorUserId: actor.id, productIds: [created.product.id], action: "approve" });
    const detail = await getAdminProductReviewDetail(created.product.id);
    expect(detail?.images).toHaveLength(1);
    expect(detail?.history.some(item => item.action === "product.batch_review" && item.outcome === "allowed")).toBe(true);
    expect(Object.keys(detail?.seller ?? {})).not.toContain("email");
    expect(Object.keys(detail?.history[0]?.actor ?? {})).not.toContain("email");
  });
});
