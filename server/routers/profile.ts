import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const profileRouter = router({
  mine: protectedProcedure.query(({ ctx }) => db.getPersonalCenterForUser(ctx.user.id)),
});
