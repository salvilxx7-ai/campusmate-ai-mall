import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const adminRouter = router({
  products: adminProcedure.query(() => db.listProducts({})),
  knowledgeDocuments: adminProcedure.query(() => db.listKnowledgeDocuments()),
  seedDemoKnowledgeBase: adminProcedure.mutation(({ ctx }) => db.seedDemoKnowledgeBase(ctx.user.id)),
  evaluationOverview: adminProcedure.query(() => db.getEvaluationOverview()),
  runFixedEvaluation: adminProcedure.mutation(() => db.runFixedEvaluation()),
  uploadKnowledgeDocument: adminProcedure
    .input(z.object({
      fileName: z.string().min(1).max(160),
      mimeType: z.enum(["text/plain", "text/markdown"]),
      sourceType: z.enum(["policy", "after_sales", "faq"]),
      base64Content: z.string().min(1).max(200_000),
    }))
    .mutation(({ ctx, input }) => db.uploadKnowledgeDocument({ ...input, actorUserId: ctx.user.id })),
  updateProductStatus: adminProcedure
    .input(z.object({ productId: z.number().int().positive(), status: z.enum(["active", "reserved", "archived"]) }))
    .mutation(({ ctx, input }) => db.updateProductStatus({ ...input, actorUserId: ctx.user.id })),
  seedDemoCatalog: adminProcedure.mutation(async ({ ctx }) => {
    const result = await db.seedDemoCatalog();
    await db.writeAuditLog({
      actorUserId: ctx.user.id,
      action: "catalog.seed",
      resourceType: "catalog",
      outcome: "allowed",
      reason: result.reason,
    });
    return result;
  }),
});
