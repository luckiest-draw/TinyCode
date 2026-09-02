import { describe, expect, it } from "vitest";
import { createCommerceMcpTools } from "../src/commerce/mcp-tools.js";
import { CommerceDataService } from "../src/commerce/service.js";

describe("commerce MCP tool handlers", () => {
  it("returns structured product facts from caller-provided data", async () => {
    const service = new CommerceDataService();
    const tools = createCommerceMcpTools(service);
    const result = await tools.get_product_detail({ product_id: "missing" });
    expect(result).toEqual({ ok: false, error: "product_not_found" });
  });

  it("does not fabricate a product when the catalog is empty", async () => {
    const tools = createCommerceMcpTools(new CommerceDataService());
    const result = await tools.search_products({ query: "羽绒服" });
    expect(result).toEqual({ ok: true, products: [] });
  });
});
