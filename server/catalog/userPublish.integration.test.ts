import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key: `test/${key}`, url: `/manus-storage/test/${key}` })),
  storageGetSignedUrl: vi.fn(),
}));

import { categories, users } from "../../drizzle/schema";
import { createUserListing, getDb, getProduct, listProducts } from "../db";

describe("user listing publish flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores images by reference, assigns the current seller, and keeps a new listing out of the public catalog pending review", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证发布流程");
    const [actor] = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
    const [category] = await database.select().from(categories).limit(1);
    if (!actor || !category) throw new Error("缺少演示用户或分类");
    const title = `发布流程测试教材-${Date.now()}`;
    const created = await createUserListing({
      userId: actor.id,
      categoryId: category.id,
      title,
      description: "用于验证发布归属、待审核状态与对象存储引用的详细演示描述。",
      priceCents: 3300,
      condition: "good",
      images: [{ name: "textbook.png", dataUrl: `data:image/png;base64,${Buffer.from("listing-image").toString("base64")}` }],
    });
    expect(created?.product.sellerUserId).toBe(actor.id);
    expect(created?.product.status).toBe("pending_review");
    expect(created?.images[0]?.url).toContain("/manus-storage/test/listings/");
    expect(await getProduct(created!.product.id)).toBeUndefined();
    expect((await listProducts({ status: "active" })).some(item => item.product.id === created?.product.id)).toBe(false);
  });
});
