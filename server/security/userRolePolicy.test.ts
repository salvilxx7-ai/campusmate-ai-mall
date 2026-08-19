import { describe, expect, it } from "vitest";
import { decideUserRoleChange } from "./userRolePolicy";

describe("user role management policy", () => {
  it("rejects an administrator changing their own role", () => {
    expect(decideUserRoleChange({ actorUserId: 7, targetUserId: 7, currentRole: "admin", nextRole: "user", administratorCount: 2 })).toMatchObject({ kind: "deny", reason: "self_role_change_blocked" });
  });

  it("rejects demotion of the last administrator", () => {
    expect(decideUserRoleChange({ actorUserId: 7, targetUserId: 8, currentRole: "admin", nextRole: "user", administratorCount: 1 })).toMatchObject({ kind: "deny", reason: "last_admin_protection" });
  });

  it("allows an administrator to promote another user and treats unchanged roles as no-op", () => {
    expect(decideUserRoleChange({ actorUserId: 7, targetUserId: 8, currentRole: "user", nextRole: "admin", administratorCount: 1 })).toEqual({ kind: "allow" });
    expect(decideUserRoleChange({ actorUserId: 7, targetUserId: 8, currentRole: "user", nextRole: "user", administratorCount: 1 })).toEqual({ kind: "noop" });
  });
});
