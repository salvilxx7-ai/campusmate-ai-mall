export type AuditMutation = "append" | "update" | "delete";

/**
 * CampusMate only permits append operations for audit events. No server route
 * calls this guard with update/delete, and tests keep that contract explicit.
 */
export function assertAuditMutationAllowed(mutation: AuditMutation) {
  if (mutation !== "append") {
    throw new Error("CampusMate audit logs are append-only");
  }
  return true;
}
