import { describe, expect, it } from "vitest";
import { CommerceDataService } from "../src/commerce/service.js";

describe("CommerceDataService", () => {
  it("loads caller-owned product data and exposes knowledge search", () => {
    const service = new CommerceDataService();
    expect(service.searchProducts("羽绒")).toEqual([]);
    expect(service.searchProductKnowledge("材质")).toEqual({
      ok: false,
      error: "knowledge_base_not_configured",
    });
  });
});
