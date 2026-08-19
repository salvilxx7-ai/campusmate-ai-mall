import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

const editableProfileInput = z.object({
  profileName: z.string().trim().max(64),
  campus: z.string().trim().max(96),
  major: z.string().trim().max(96),
  bio: z.string().trim().max(280),
});

export const profileRouter = router({
  mine: protectedProcedure.query(({ ctx }) => db.getPersonalCenterForUser(ctx.user.id)),
  me: protectedProcedure.query(({ ctx }) => db.getEditableProfileForUser(ctx.user.id)),
  updateMe: protectedProcedure.input(editableProfileInput).mutation(({ ctx, input }) => db.updateEditableProfileForUser({ userId: ctx.user.id, ...input })),
});
