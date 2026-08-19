import { z } from "zod";
import * as db from "../db";
import { adminProcedure, router } from "../_core/trpc";
import { runFixedRetrievalQualityEvaluation } from "../evaluation/retrievalQuality";

export const adminRouter = router({
  products: adminProcedure.query(() => db.listProducts({})),
  users: adminProcedure.query(() => db.listUsersForAdmin()),
  supportTickets: adminProcedure.query(() => db.listSupportTicketsForAdmin()),
  updateSupportTicketStatus: adminProcedure
    .input(z.object({ ticketId: z.number().int().positive(), status: z.enum(["open", "in_review", "resolved"]) }))
    .mutation(({ ctx, input }) => db.updateSupportTicketStatusByAdmin({ actorUserId: ctx.user.id, ...input })),
  updateUserRole: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
    .mutation(({ ctx, input }) => db.updateUserRoleByAdmin({ actorUserId: ctx.user.id, targetUserId: input.userId, role: input.role })),
  knowledgeDocuments: adminProcedure.query(() => db.listKnowledgeDocuments()),
  seedDemoKnowledgeBase: adminProcedure.mutation(({ ctx }) => db.seedDemoKnowledgeBase(ctx.user.id)),
  evaluationOverview: adminProcedure.query(() => db.getEvaluationOverview()),
  retrievalQualityOverview: adminProcedure.query(() => runFixedRetrievalQualityEvaluation()),
  runFixedEvaluation: adminProcedure.mutation(() => db.runFixedEvaluation()),
  uploadKnowledgeDocument: adminProcedure
    .input(z.object({
      fileName: z.string().min(1).max(160),
      mimeType: z.enum(["text/plain", "text/markdown"]),
      sourceType: z.enum(["policy", "after_sales", "faq"]),
      publicSourceUrl: z.string().url().refine(value => value.startsWith("https://"), "仅支持 HTTPS 公开来源 URL"),
      base64Content: z.string().min(1).max(200_000),
      supersedesDocumentId: z.number().int().positive().optional(),
    }))
    .mutation(({ ctx, input }) => db.uploadKnowledgeDocument({ ...input, actorUserId: ctx.user.id })),
  retryKnowledgeVectorSync: adminProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => db.syncKnowledgeDocumentToChroma({ documentId: input.documentId, actorUserId: ctx.user.id })),
  rebuildKnowledgeVectorIndex: adminProcedure
    .mutation(({ ctx }) => db.rebuildActiveKnowledgeDocuments({ actorUserId: ctx.user.id })),
  retireKnowledgeDocument: adminProcedure
    .input(z.object({ documentId: z.number().int().positive(), reason: z.string().trim().min(4).max(255) }))
    .mutation(({ ctx, input }) => db.retireKnowledgeDocument({ ...input, actorUserId: ctx.user.id })),
  updateProductStatus: adminProcedure
    .input(z.object({ productId: z.number().int().positive(), status: z.enum(["pending_review", "active", "reserved", "archived"]) }))
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
