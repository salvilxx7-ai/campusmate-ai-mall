import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("../storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key: `test/${key}`, url: `/manus-storage/test/${key}` })),
  storageGetSignedUrl: vi.fn(),
}));

import { categories, products, users } from "../../drizzle/schema";
import { batchReviewProducts, createUserListing, getDb, getProduct, resubmitUserListing, updateUserListing, withdrawUserListing } from "../db";

describe("owner listing management", () => {
  let createdProductId: number | undefined;
  beforeEach(() => vi.clearAllMocks());
  afterEach(async () => {
    if (!createdProductId) return;
    const database = await getDb();
    await database?.delete(products).where(eq(products.id, createdProductId));
    createdProductId = undefined;
  });

  it("allows only the owner to edit, withdraw and resubmit a listing", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证发布物品管理流程");
    const [actor] = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
    const [category] = await database.select().from(categories).limit(1);
    if (!actor || !category) throw new Error("缺少演示用户或分类");
    const created = await createUserListing({ userId: actor.id, categoryId: category.id, title: `物品管理测试-${Date.now()}`, description: "用于验证本人编辑、撤回和重新提交状态转换的详细演示描述。", priceCents: 4500, condition: "good", images: [{ name: "source.png", dataUrl: `data:image/png;base64,${Buffer.from("source-image").toString("base64")}` }] });
    if (!created) throw new Error("测试商品创建失败");
    createdProductId = created.product.id;
    await expect(updateUserListing({ userId: actor.id + 9_999_999, productId: created.product.id, categoryId: category.id, title: "越权编辑", description: "这是一段不应被未归属账户写入的详细描述。", priceCents: 5000, condition: "excellent" })).rejects.toThrow("未找到可管理的商品");
    const edited = await updateUserListing({ userId: actor.id, productId: created.product.id, categoryId: category.id, title: `${created.product.title}-已编辑`, description: "这是经过本人编辑后、会重新进入审核流程的详细演示描述。", priceCents: 4700, condition: "excellent" });
    expect(edited?.product.status).toBe("pending_review");
    expect(edited?.product.title).toContain("已编辑");
    const withdrawn = await withdrawUserListing({ userId: actor.id, productId: created.product.id });
    expect(withdrawn?.product.status).toBe("archived");
    const resubmitted = await resubmitUserListing({ userId: actor.id, productId: created.product.id });
    expect(resubmitted?.product.status).toBe("pending_review");
    expect((await getProduct(created.product.id, true))?.product.reviewReason).toBeNull();
  });

  it("processes valid pending listings while returning a per-item skipped result for a missing batch member", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证批量审核流程");
    const [actor] = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
    const [category] = await database.select().from(categories).limit(1);
    if (!actor || !category) throw new Error("缺少演示用户或分类");
    const created = await createUserListing({ userId: actor.id, categoryId: category.id, title: `批量审核测试-${Date.now()}`, description: "用于验证批量审核有效项成功与无效项单独跳过的详细演示描述。", priceCents: 5200, condition: "good", images: [{ name: "review.png", dataUrl: `data:image/png;base64,${Buffer.from("review-image").toString("base64")}` }] });
    if (!created) throw new Error("测试商品创建失败");
    createdProductId = created.product.id;
    const result = await batchReviewProducts({ actorUserId: actor.id, productIds: [created.product.id, 999_999_999], action: "approve" });
    expect(result.approvedCount).toBe(1);
    expect(result.rejectedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect((await getProduct(created.product.id, true))?.product.status).toBe("active");
    expect(result.results.find(item => item.productId === 999_999_999)).toMatchObject({ outcome: "skipped", message: "商品不存在" });
  });
});
