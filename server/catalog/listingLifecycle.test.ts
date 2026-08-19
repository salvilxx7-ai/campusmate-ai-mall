import { describe, expect, it } from "vitest";
import { decideAdministratorReview, decideOwnerListingEdit, decideOwnerListingResubmission, decideOwnerListingWithdrawal } from "./listingLifecycle";

describe("listing lifecycle policy", () => {
  it("sends permitted owner edits back through pending review and blocks reserved listings", () => {
    expect(decideOwnerListingEdit("active")).toEqual({ kind: "allow", nextStatus: "pending_review" });
    expect(decideOwnerListingEdit("rejected")).toEqual({ kind: "allow", nextStatus: "pending_review" });
    expect(decideOwnerListingEdit("reserved")).toMatchObject({ kind: "deny" });
  });

  it("only permits withdrawal and resubmission along the defined owner transitions", () => {
    expect(decideOwnerListingWithdrawal("active")).toEqual({ kind: "allow", nextStatus: "archived" });
    expect(decideOwnerListingWithdrawal("archived")).toEqual({ kind: "noop", nextStatus: "archived" });
    expect(decideOwnerListingWithdrawal("reserved")).toMatchObject({ kind: "deny" });
    expect(decideOwnerListingResubmission("rejected")).toEqual({ kind: "allow", nextStatus: "pending_review" });
    expect(decideOwnerListingResubmission("archived")).toEqual({ kind: "allow", nextStatus: "pending_review" });
    expect(decideOwnerListingResubmission("active")).toMatchObject({ kind: "deny" });
  });

  it("allows administrator review only for pending listings", () => {
    expect(decideAdministratorReview("pending_review", "approve")).toEqual({ kind: "allow", nextStatus: "active" });
    expect(decideAdministratorReview("pending_review", "reject")).toEqual({ kind: "allow", nextStatus: "rejected" });
    expect(decideAdministratorReview("active", "reject")).toMatchObject({ kind: "deny" });
  });
});
