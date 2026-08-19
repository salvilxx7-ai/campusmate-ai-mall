import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { catalogRouter } from "../routers/catalog";

const anonymousContext: TrpcContext = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("catalog.publish authentication boundary", () => {
  it("rejects unauthenticated attempts before accepting image or listing fields", async () => {
    const caller = catalogRouter.createCaller(anonymousContext);
    await expect(caller.publish({ categoryId: 1, title: "演示教材", description: "这是一段足够长的详细描述。", priceCents: 1200, condition: "good", images: [{ name: "cover.png", dataUrl: "data:image/png;base64,aW1hZ2U=" }] })).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });
  });
});
