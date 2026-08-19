import { describe, expect, it } from "vitest";
import { buildOrderReadAuditEvent } from "./orderAudit";

describe("order-read audit event", () => {
  it("constructs a denied append record for a cross-account request", () => {
    expect(buildOrderReadAuditEvent({ actorUserId: 9, orderId: 42, decision: { allowed: false, reason: "ownership_mismatch" } })).toEqual({ actorUserId: 9, action: "order.read", resourceType: "order", resourceId: "42", outcome: "denied", reason: "ownership_mismatch" });
  });

  it("constructs an allowed append record for the owner", () => {
    expect(buildOrderReadAuditEvent({ actorUserId: 8, orderId: 42, decision: { allowed: true, reason: "owner_read" } }).outcome).toBe("allowed");
  });
});
