import { describe, expect, it } from "vitest";
import { classifyCustomerIntent } from "./customerAgent";

describe("customer-service intent router", () => {
  it("routes an explicit human request without calling knowledge search", () => expect(classifyCustomerIntent("我想转人工客服")).toBe("human_handoff"));
  it("routes item discovery to the catalog tool", () => expect(classifyCustomerIntent("有没有适合复习的教材？")).toBe("product_search"));
  it("routes order requests to the owner-scoped order tool", () => expect(classifyCustomerIntent("请查一下订单 42")).toBe("own_order"));
  it("keeps ordinary rule questions inside the grounded knowledge flow", () => expect(classifyCustomerIntent("什么商品不能上架？")).toBe("policy_qa"));
});
