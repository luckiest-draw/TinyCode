import { describe, expect, it } from "vitest";
import { CommerceDataService } from "../src/commerce/service.js";
import { createCommerceMcpTools } from "../src/commerce/mcp-tools.js";

function sampleService(): CommerceDataService {
  return new CommerceDataService({
    orders: [
      { id: "o-1", status: "cancelled", total: 12 },
      { id: "o-2", status: "delivered", total: 30 },
      { id: "o-3", status: "CANCELLED", total: 7 },
      { id: "o-4", status: "shipped", total: 9 },
    ],
    logistics: [
      { order_id: "o-1", status: "cancelled" },
      { order_id: "o-2", status: "delivered" },
    ],
  });
}

describe("CommerceDataService.searchOrders", () => {
  it("returns all orders when no status filter is given", () => {
    const service = sampleService();
    expect(service.searchOrders().map((o) => o.id)).toEqual(["o-1", "o-2", "o-3", "o-4"]);
  });

  it("filters by status case-insensitively", () => {
    const service = sampleService();
    const cancelled = service.searchOrders({ status: "cancelled" });
    expect(cancelled.map((o) => o.id)).toEqual(["o-1", "o-3"]);
    expect(service.searchOrders({ status: "CANCELLED" }).map((o) => o.id)).toEqual(["o-1", "o-3"]);
  });

  it("honors the limit and caps at 100", () => {
    const service = sampleService();
    expect(service.searchOrders({ limit: 2 })).toHaveLength(2);
    expect(service.searchOrders({ limit: 500 })).toHaveLength(4);
  });
});

describe("commerce search_orders MCP handler", () => {
  it("exposes cancelled orders through the tool surface", async () => {
    const tools = createCommerceMcpTools(sampleService());
    const result = await tools.search_orders({ status: "cancelled" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(2);
      expect(result.orders.map((o: { id: string }) => o.id)).toEqual(["o-1", "o-3"]);
    }
  });

  it("reports an empty result with a status-specific message", async () => {
    const tools = createCommerceMcpTools(sampleService());
    const result = await tools.search_orders({ status: "processing" });
    expect(result.ok).toBe(false);
  });
});
