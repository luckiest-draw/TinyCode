import { describe, expect, it } from "vitest";
import { createCommerceMcpTools } from "../src/commerce/mcp-tools.js";
import { CommerceDataService } from "../src/commerce/service.js";

describe("commerce MCP transaction tools", () => {
  it("exposes order and logistics lookups as read-only handlers", async () => {
    const tools = createCommerceMcpTools(new CommerceDataService({
      orders: [{ id: "order-1", status: "shipped" }],
      logistics: [{ order_id: "order-1", status: "in_transit" }],
    }));

    expect(await tools.get_order_detail({ order_id: "order-1" })).toEqual({
      ok: true,
      order: { id: "order-1", status: "shipped" },
    });
    expect(await tools.get_logistics_status({ order_id: "order-1" })).toEqual({
      ok: true,
      logistics: { order_id: "order-1", status: "in_transit" },
    });
  });
});
