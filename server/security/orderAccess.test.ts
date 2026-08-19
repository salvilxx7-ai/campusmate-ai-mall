import { describe, expect, it } from "vitest";
import { decideOrderAccess } from "./orderAccess";

describe("order ownership access", () => {
  it("allows the account that owns the order", () => {
    expect(decideOrderAccess({ orderOwnerUserId: 8, actorUserId: 8, isAdmin: false })).toEqual({ allowed: true, reason: "owner_read" });
  });

  it("denies another ordinary user", () => {
    expect(decideOrderAccess({ orderOwnerUserId: 8, actorUserId: 9, isAdmin: false })).toEqual({ allowed: false, reason: "ownership_mismatch" });
  });

  it("keeps the default owner-only boundary when an order tool never supplies an administrator bypass", () => {
    expect(decideOrderAccess({ orderOwnerUserId: 8, actorUserId: 9, isAdmin: false })).toEqual({ allowed: false, reason: "ownership_mismatch" });
  });
});
