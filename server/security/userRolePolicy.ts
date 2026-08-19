export type UserRole = "user" | "admin";

export type RoleChangeDecision =
  | { kind: "allow" }
  | { kind: "noop" }
  | { kind: "deny"; reason: "self_role_change_blocked" | "last_admin_protection"; message: string };

export function decideUserRoleChange(input: { actorUserId: number; targetUserId: number; currentRole: UserRole; nextRole: UserRole; administratorCount: number }): RoleChangeDecision {
  if (input.actorUserId === input.targetUserId) {
    return { kind: "deny", reason: "self_role_change_blocked", message: "为避免误锁定管理员账号，不能修改自己的角色" };
  }
  if (input.currentRole === input.nextRole) return { kind: "noop" };
  if (input.currentRole === "admin" && input.nextRole === "user" && input.administratorCount <= 1) {
    return { kind: "deny", reason: "last_admin_protection", message: "系统必须至少保留一名管理员，无法降级最后一个管理员账号" };
  }
  return { kind: "allow" };
}
