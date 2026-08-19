import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../_core/context";
import { adminRouter } from "../routers/admin";

const ordinaryUserContext: TrpcContext = {
  user: { id: 999991, openId: "ordinary-ticket-user", role: "user", name: null, email: null, loginMethod: null, profileName: null, campus: null, major: null, bio: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("administrator support-ticket boundary", () => {
  it("rejects ordinary users from reading or updating the processing queue", async () => {
    const caller = adminRouter.createCaller(ordinaryUserContext);
    await expect(caller.supportTickets()).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
    await expect(caller.updateSupportTicketStatus({ ticketId: 1, status: "resolved" })).rejects.toMatchObject<Partial<TRPCError>>({ code: "FORBIDDEN" });
  });
});
