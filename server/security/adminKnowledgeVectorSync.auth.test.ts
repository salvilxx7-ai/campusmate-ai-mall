import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { adminRouter } from "../routers/admin";

const ordinaryUserContext: TrpcContext = {
  user: { id: 21, openId: "ordinary-user", name: "普通用户", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("admin knowledge vector sync boundary", () => {
  it("rejects an ordinary user before a Chroma retry can be requested", async () => {
    const caller = adminRouter.createCaller(ordinaryUserContext);
    await expect(caller.retryKnowledgeVectorSync({ documentId: 1 })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });
});
