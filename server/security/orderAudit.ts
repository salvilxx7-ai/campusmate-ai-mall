export function buildOrderReadAuditEvent(input: { actorUserId: number; orderId: number; decision: { allowed: boolean; reason: string } }) {
  return {
    actorUserId: input.actorUserId,
    action: "order.read",
    resourceType: "order",
    resourceId: String(input.orderId),
    outcome: input.decision.allowed ? "allowed" as const : "denied" as const,
    reason: input.decision.reason,
  };
}
