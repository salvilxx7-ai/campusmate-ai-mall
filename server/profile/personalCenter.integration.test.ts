import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../../drizzle/schema";
import { getDb, getPersonalCenterForUser, listPublishedProductsForUser } from "../db";

describe("personal-center current-user scoping", () => {
  it("returns only listings whose seller user matches the requested account", async () => {
    const database = await getDb();
    if (!database) throw new Error("数据库暂不可用，无法验证个人中心归属");
    const admin = await database.select().from(users).where(eq(users.role, "admin")).limit(1);
    const actor = admin[0];
    if (!actor) throw new Error("缺少演示管理员账户");

    const center = await getPersonalCenterForUser(actor.id);
    expect(center.listings.length).toBeGreaterThan(0);
    expect(center.listings.every(item => item.product.sellerUserId === actor.id)).toBe(true);

    const unrelatedListings = await listPublishedProductsForUser(actor.id + 999999);
    expect(unrelatedListings).toEqual([]);
  });
});
