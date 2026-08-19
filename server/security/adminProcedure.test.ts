import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { adminProcedure, router } from "../_core/trpc";
import type { TrpcContext } from "../_core/context";

const protectedAdminTestRouter = router({
  readAdminOnly: adminProcedure.query(() => "admin-only"),
});

function context(role: "admin" | "user"): TrpcContext {
  return {
    user: { id: 1, openId: `${role}-user`, name: role, email: null, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin procedure", () => {
  it("rejects ordinary users at the server boundary", async () => {
    const caller = protectedAdminTestRouter.createCaller(context("user"));
    await expect(caller.readAdminOnly()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });

  it("allows an authenticated administrator", async () => {
    const caller = protectedAdminTestRouter.createCaller(context("admin"));
    await expect(caller.readAdminOnly()).resolves.toBe("admin-only");
  });
});
