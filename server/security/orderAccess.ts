export function decideOrderAccess(input: { orderOwnerUserId: number; actorUserId: number; isAdmin: boolean }) {
  if (input.isAdmin || input.orderOwnerUserId === input.actorUserId) {
    return { allowed: true as const, reason: input.isAdmin ? "admin_review" : "owner_read" };
  }
  return { allowed: false as const, reason: "ownership_mismatch" };
}
