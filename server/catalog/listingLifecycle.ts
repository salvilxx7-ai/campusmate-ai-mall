export type ListingStatus = "pending_review" | "active" | "reserved" | "archived" | "rejected";

type Decision = { kind: "allow"; nextStatus: ListingStatus } | { kind: "noop"; nextStatus: ListingStatus } | { kind: "deny"; message: string };

export function decideOwnerListingEdit(status: ListingStatus): Decision {
  if (status === "reserved") return { kind: "deny", message: "已被预留的商品不能编辑，请先完成或取消相关订单" };
  return { kind: "allow", nextStatus: "pending_review" };
}

export function decideOwnerListingWithdrawal(status: ListingStatus): Decision {
  if (status === "reserved") return { kind: "deny", message: "已被预留的商品不能撤回" };
  if (status === "archived") return { kind: "noop", nextStatus: "archived" };
  return { kind: "allow", nextStatus: "archived" };
}

export function decideOwnerListingResubmission(status: ListingStatus): Decision {
  if (status === "pending_review") return { kind: "noop", nextStatus: "pending_review" };
  if (status === "rejected" || status === "archived") return { kind: "allow", nextStatus: "pending_review" };
  return { kind: "deny", message: "只有已拒绝或已撤回的商品可以重新提交审核" };
}

export function decideAdministratorReview(status: ListingStatus, action: "approve" | "reject"): Decision {
  if (status !== "pending_review") return { kind: "deny", message: "仅等待审核的商品可参与本次审核" };
  return { kind: "allow", nextStatus: action === "approve" ? "active" : "rejected" };
}
