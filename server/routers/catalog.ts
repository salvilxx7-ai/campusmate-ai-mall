import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const publishInput = z.object({
  categoryId: z.number().int().positive(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  priceCents: z.number().int().min(100).max(9_999_999),
  condition: z.enum(["excellent", "good", "fair"]),
  images: z.array(z.object({ name: z.string().max(100), dataUrl: z.string().max(2_800_000) })).min(1).max(3),
});

const listingEditInput = publishInput.omit({ images: true }).extend({
  productId: z.number().int().positive(),
  images: z.array(z.object({ name: z.string().max(100), dataUrl: z.string().max(2_800_000) })).min(1).max(3).optional(),
});

export const catalogRouter = router({
  categories: publicProcedure.query(() => db.listCategories()),
  list: publicProcedure
    .input(z.object({ query: z.string().max(80).optional(), categorySlug: z.string().max(64).optional() }).optional())
    .query(({ input }) => db.listProducts({ query: input?.query, categorySlug: input?.categorySlug, status: "active" })),
  featured: publicProcedure.query(() => db.listProducts({ status: "active", limit: 6 })),
  get: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => db.getProduct(input.productId)),
  publish: protectedProcedure.input(publishInput).mutation(({ ctx, input }) => db.createUserListing({ userId: ctx.user.id, ...input })),
  updateListing: protectedProcedure.input(listingEditInput).mutation(({ ctx, input }) => db.updateUserListing({ userId: ctx.user.id, ...input })),
  withdrawListing: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(({ ctx, input }) => db.withdrawUserListing({ userId: ctx.user.id, ...input })),
  resubmitListing: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(({ ctx, input }) => db.resubmitUserListing({ userId: ctx.user.id, ...input })),
});
