import { z } from "zod";
import * as db from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const catalogRouter = router({
  categories: publicProcedure.query(() => db.listCategories()),
  list: publicProcedure
    .input(z.object({ query: z.string().max(80).optional(), categorySlug: z.string().max(64).optional() }).optional())
    .query(({ input }) => db.listProducts({ query: input?.query, categorySlug: input?.categorySlug, status: "active" })),
  featured: publicProcedure.query(() => db.listProducts({ status: "active", limit: 6 })),
  get: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => db.getProduct(input.productId)),
});
