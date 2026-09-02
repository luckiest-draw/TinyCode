import { describe, expect, it } from "vitest";
import { parseCommerceResponse } from "../src/commerce/response.js";

describe("commerce response protocol", () => {
  it("accepts a customer-service response with facts and human review items", () => {
    expect(parseCommerceResponse({
      task: "customer_service",
      facts: ["商品详情显示支持机洗"],
      customer_reply: "这款商品支持机洗。",
      internal_note: "已引用商品说明",
      pending_confirmation: [],
    })).toMatchObject({ task: "customer_service", facts: ["商品详情显示支持机洗"] });
  });

  it("rejects responses that omit the customer-facing reply", () => {
    expect(() => parseCommerceResponse({ task: "customer_service", facts: [] })).toThrow();
  });
});
