import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { McpManager } from "../src/mcp/manager.js";
import { registerMcpTools } from "../src/mcp/adapter.js";
import { ToolRegistry } from "../src/tools/registry.js";

describe("commerce MCP stdio integration", () => {
  it("exposes external product data and knowledge retrieval through TinyCode", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tinycode-commerce-mcp-"));
    const productsPath = path.join(root, "products.json");
    const ragPath = path.join(root, "knowledge.sqlite");
    const knowledgePath = path.join(root, "knowledge");
    const serverPath = path.resolve("src/commerce/mcp-server.ts");
    writeFileSync(productsPath, JSON.stringify([
      { id: "p-1", title: "轻薄羽绒服", description: "冬季通勤", price: 399, stock: 8 },
    ]));
    mkdirSync(knowledgePath);
    writeFileSync(path.join(knowledgePath, "p-1.md"), "# 材质\n\n采用防泼水面料。", "utf8");

    const manager = new McpManager({
      commerce: {
        command: process.execPath,
        args: ["--import", "tsx", serverPath],
        env: {
          TINYCODE_COMMERCE_PRODUCTS: productsPath,
          TINYCODE_COMMERCE_RAG_DB: ragPath,
          TINYCODE_COMMERCE_KNOWLEDGE_DIR: knowledgePath,
        },
        timeoutMs: 30000,
      },
    });
    try {
      await manager.startAll();
      expect(manager.statuses()[0]?.status).toBe("connected");
      const registry = new ToolRegistry();
      registerMcpTools(registry, manager);
      const product = await registry.get("get_product_detail")?.execute("t1", { product_id: "p-1" });
      expect(JSON.stringify(product)).toContain("轻薄羽绒服");
      const knowledge = await registry.get("search_product_knowledge")?.execute("t2", { query: "防泼水" });
      expect(JSON.stringify(knowledge)).toContain("防泼水面料");
    } finally {
      await manager.shutdown();
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});
