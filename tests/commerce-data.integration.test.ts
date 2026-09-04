import { describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommerceDataService } from "../src/commerce/service.js";

/**
 * Integration test against the committed CC0 synthetic fixtures (data/).
 * Proves the MCP data layer reads real files: structured products/orders/
 * logistics, a cancelled-order search, and BM25 knowledge retrieval from the
 * committed Markdown policy docs.
 */
const fixture = "data";
const ragDb = join(tmpdir(), `commerce-data-${process.pid}-${Date.now()}.sqlite`);

describe("commerce data fixtures", () => {
  it("loads the committed synthetic catalog", () => {
    const service = new CommerceDataService({
      productsPath: join(fixture, "products.json"),
      ordersPath: join(fixture, "orders.json"),
      logisticsPath: join(fixture, "logistics.json"),
    });
    expect(service.catalog.size).toBeGreaterThan(100);
    const product = service.searchProducts("Mobile & Telecom")[0];
    expect(product).toBeDefined();
    expect(service.getProduct(product!.id)).toMatchObject({ id: product!.id, price: expect.any(Number), stock: expect.any(Number) });
  });

  it("finds real cancelled orders in the committed fixture", () => {
    const service = new CommerceDataService({
      productsPath: join(fixture, "products.json"),
      ordersPath: join(fixture, "orders.json"),
      logisticsPath: join(fixture, "logistics.json"),
    });
    const cancelled = service.searchOrders({ status: "cancelled" });
    expect(cancelled.length).toBeGreaterThan(0);
    expect(cancelled.every((o) => o.status === "cancelled")).toBe(true);
    // A cancelled order has an id that can be fetched by detail and has logistics.
    const first = cancelled[0]!;
    expect(service.getOrder(String(first.id))?.status).toBe("cancelled");
    expect(service.getLogistics(String(first.id))).toBeDefined();
  });

  it("retrieves policy knowledge from the committed Markdown via BM25", () => {
    let service: CommerceDataService | undefined;
    try {
      service = new CommerceDataService({
        productsPath: join(fixture, "products.json"),
        ordersPath: join(fixture, "orders.json"),
        logisticsPath: join(fixture, "logistics.json"),
        ragDatabasePath: ragDb,
        knowledgeDirectory: join(fixture, "knowledge"),
      });
      const result = service.searchProductKnowledge("how long does a refund take", 3);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.hits.length).toBeGreaterThan(0);
        const all = result.hits.map((h) => `${h.source} ${h.text}`).join("\n");
        expect(all.toLowerCase()).toContain("refund");
      }
    } finally {
      // Close the SQLite handle before removing the temp file (Windows lock).
      service?.close();
      if (existsSync(ragDb)) rmSync(ragDb, { force: true });
    }
  });
});
