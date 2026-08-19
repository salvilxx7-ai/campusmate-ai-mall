import { buildOrderReadAuditEvent } from "./orderAudit";
import { decideOrderAccess } from "./orderAccess";

type AuditEvent = { actorUserId: number; action: string; resourceType: string; resourceId?: string; outcome: "allowed" | "denied"; reason?: string };

export async function resolveOrderRead<T extends { userId: number }>(input: { orderId: number; order?: T; actorUserId: number; isAdmin: boolean; appendAudit: (event: AuditEvent) => Promise<void> }) {
  if (!input.order) return { kind: "missing" as const };
  const decision = decideOrderAccess({ orderOwnerUserId: input.order.userId, actorUserId: input.actorUserId, isAdmin: input.isAdmin });
  await input.appendAudit(buildOrderReadAuditEvent({ actorUserId: input.actorUserId, orderId: input.orderId, decision }));
  return decision.allowed ? { kind: "allowed" as const, order: input.order } : { kind: "denied" as const };
}

export async function resolveOwnerOrderList<T>(input: { actorUserId: number; load: () => Promise<T[]>; appendAudit: (event: AuditEvent) => Promise<void> }) {
  const orders = await input.load();
  await input.appendAudit({ actorUserId: input.actorUserId, action: "order.list", resourceType: "order", outcome: "allowed", reason: "owner_scoped_list" });
  return orders;
}
