import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { adminRouter } from "../routers/admin";

const ordinaryUserContext: TrpcContext = { user: { id: 9991, openId: "ordinary-reviewer", name: "普通用户", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), email: null, loginMethod: null, profileName: null, campus: null, major: null, bio: null }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("administrator batch listing review authorization", () => {
  it("rejects an ordinary user before any bulk decision can reach the database", async () => {
    const caller = adminRouter.createCaller(ordinaryUserContext);
    await expect(caller.products({ status: "pending_review" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.batchReviewProducts({ productIds: [1], action: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.batchReviewProducts({ productIds: [1], action: "reject", reviewReason: "商品信息不完整" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
