import { describe, expect, it } from "vitest";
import { CommerceDataService } from "../src/commerce/service.js";
import { createCommerceMcpTools } from "../src/commerce/mcp-tools.js";

describe("commerce customer-service and operations tools", () => {
  it("returns safe not-configured results when transactional data is absent", async () => {
    const tools = createCommerceMcpTools(new CommerceDataService());

    expect(await tools.get_order_detail({ order_id: "o-1" })).toEqual({
      ok: false,
      error: "order_source_not_configured",
    });
    expect(await tools.get_logistics_status({ order_id: "o-1" })).toEqual({
      ok: false,
      error: "logistics_source_not_configured",
    });
  });

  it("searches caller-provided order and logistics records", async () => {
    const service = new CommerceDataService({
      orders: [{ id: "o-1", product_id: "p-1", status: "shipped" }],
      logistics: [{ order_id: "o-1", status: "in_transit", carrier: "carrier-a" }],
    });
    const tools = createCommerceMcpTools(service);

    expect(await tools.get_order_detail({ order_id: "o-1" })).toMatchObject({ ok: true, order: { status: "shipped" } });
    expect(await tools.get_logistics_status({ order_id: "o-1" })).toMatchObject({ ok: true, logistics: { status: "in_transit" } });
  });
});
