import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { profileRouter } from "../routers/profile";

const anonymousContext: TrpcContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("profile.mine authentication boundary", () => {
  it("rejects an unauthenticated caller before querying personal data", async () => {
    const caller = profileRouter.createCaller(anonymousContext);
    await expect(caller.mine()).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED" });
  });
});
