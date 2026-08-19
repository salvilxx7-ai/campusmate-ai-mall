import { describe, expect, it } from "vitest";
import { assertAuditMutationAllowed } from "./auditPolicy";

describe("audit append-only policy", () => {
  it("allows application audit appends", () => {
    expect(assertAuditMutationAllowed("append")).toBe(true);
  });

  it.each(["update", "delete"] as const)("rejects audit %s operations", mutation => {
    expect(() => assertAuditMutationAllowed(mutation)).toThrow("append-only");
  });
});
