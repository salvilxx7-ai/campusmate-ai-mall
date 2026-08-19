import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { customerServiceRouter } from "../routers/customerService";

const anonymousContext: TrpcContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("customer-service ticket authentication boundary", () => {
  it("rejects unauthenticated ticket reads and creates", async () => {
    const caller = customerServiceRouter.createCaller(anonymousContext);
    await expect(caller.listMyTickets()).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });
    await expect(caller.createTicket({
      category: "other",
      sourceMessage: "需要人工协助",
      summary: "测试模拟工单访问边界",
      workflowTrace: [{ stage: "handoff_ready", detail: "测试转人工工作流。" }],
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });
  });
});
