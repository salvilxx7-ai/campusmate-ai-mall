import { z } from "zod";
import { answerCustomerMessage } from "../agent/customerAgent";
import * as db from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const customerServiceRouter = router({
  ask: publicProcedure
    .input(z.object({ message: z.string().trim().min(2).max(500) }))
    .mutation(({ ctx, input }) => answerCustomerMessage({ message: input.message, actor: ctx.user ? { id: ctx.user.id } : undefined })),
  createTicket: protectedProcedure
    .input(z.object({
      category: z.enum(["policy", "order", "security", "other"]),
      sourceMessage: z.string().trim().min(2).max(500),
      summary: z.string().trim().min(2).max(500),
      workflowTrace: z.array(z.object({ stage: z.string().min(1).max(64), detail: z.string().min(1).max(255) })).min(1).max(12),
    }))
    .mutation(({ ctx, input }) => db.createSupportTicket({ userId: ctx.user.id, ...input })),
  listMyTickets: protectedProcedure.query(({ ctx }) => db.listSupportTicketsForUser(ctx.user.id)),
});
