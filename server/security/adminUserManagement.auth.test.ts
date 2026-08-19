import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../_core/context";
import { adminRouter } from "../routers/admin";

const ordinaryUserContext: TrpcContext = {
  user: {
    id: 88,
    openId: "ordinary-user",
    name: "普通用户",
    email: "user@example.com",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("admin user management authorization", () => {
  it("rejects ordinary users before user-directory and role-change data access", async () => {
    const caller = adminRouter.createCaller(ordinaryUserContext);
    await expect(caller.users()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
    await expect(caller.updateUserRole({ userId: 1, role: "admin" })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });
});
