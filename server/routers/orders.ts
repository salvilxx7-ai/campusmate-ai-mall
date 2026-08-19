import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const ordersRouter = router({
  listMine: protectedProcedure.query(({ ctx }) => db.listOrdersForUser(ctx.user.id)),
  getMine: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const result = await db.getOrderForActor({
      orderId: input.orderId,
      actorUserId: ctx.user.id,
      isAdmin: false,
    });
    if (result.kind === "missing") throw new TRPCError({ code: "NOT_FOUND", message: "未找到该模拟订单" });
    if (result.kind === "denied") throw new TRPCError({ code: "FORBIDDEN", message: "你没有权限查看这笔订单；该次访问已记录在安全审计中。" });
    return result.order;
  }),
  create: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(({ ctx, input }) =>
    db.createOrderForUser({ userId: ctx.user.id, productId: input.productId })
  ),
});
