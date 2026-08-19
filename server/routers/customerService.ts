import { z } from "zod";
import { answerCustomerMessage } from "../agent/customerAgent";
import { publicProcedure, router } from "../_core/trpc";

export const customerServiceRouter = router({
  ask: publicProcedure
    .input(z.object({ message: z.string().trim().min(2).max(500) }))
    .mutation(({ ctx, input }) => answerCustomerMessage({ message: input.message, actor: ctx.user ? { id: ctx.user.id } : undefined })),
});
