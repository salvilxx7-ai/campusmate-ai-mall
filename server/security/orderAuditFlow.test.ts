import { describe, expect, it, vi } from "vitest";
import { resolveOrderRead, resolveOwnerOrderList } from "./orderAuditFlow";

describe("order audit flow", () => {
  it("appends a denied audit record when a different account reads an order", async () => {
    const appendAudit = vi.fn().mockResolvedValue(undefined);
    await expect(resolveOrderRead({ orderId: 42, order: { userId: 8 }, actorUserId: 9, isAdmin: false, appendAudit })).resolves.toEqual({ kind: "denied" });
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "order.read", resourceId: "42", outcome: "denied", reason: "ownership_mismatch" }));
  });

  it("appends an allowed audit record for the order owner", async () => {
    const appendAudit = vi.fn().mockResolvedValue(undefined);
    await expect(resolveOrderRead({ orderId: 42, order: { userId: 8 }, actorUserId: 8, isAdmin: false, appendAudit })).resolves.toMatchObject({ kind: "allowed" });
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({ outcome: "allowed", reason: "owner_read" }));
  });

  it("appends a scoped-list audit record after loading only the actor's result set", async () => {
    const appendAudit = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue([{ id: 1, userId: 8 }]);
    await expect(resolveOwnerOrderList({ actorUserId: 8, load, appendAudit })).resolves.toEqual([{ id: 1, userId: 8 }]);
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "order.list", actorUserId: 8, outcome: "allowed" }));
  });
});
