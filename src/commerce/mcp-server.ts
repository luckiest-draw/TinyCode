import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CommerceDataService } from "./service.js";

const service = new CommerceDataService({
  productsPath: process.env.TINYCODE_COMMERCE_PRODUCTS,
  ragDatabasePath: process.env.TINYCODE_COMMERCE_RAG_DB,
  knowledgeDirectory: process.env.TINYCODE_COMMERCE_KNOWLEDGE_DIR,
  ordersPath: process.env.TINYCODE_COMMERCE_ORDERS,
  logisticsPath: process.env.TINYCODE_COMMERCE_LOGISTICS,
});
const server = new McpServer({ name: "tinycode-commerce", version: "0.1.0" });

server.tool("get_product_detail", "Query structured product facts from the configured catalog.", {
  product_id: z.string().min(1),
}, async ({ product_id }) => {
  const product = service.getProduct(product_id);
  return {
    content: [{ type: "text", text: JSON.stringify(
      product ? { ok: true, product } : { ok: false, error: "product_not_found" },
      null, 2,
    ) }],
  };
});

server.tool("search_products", "Search structured product records from the configured catalog.", {
  query: z.string().min(1),
}, async ({ query }) => ({
  content: [{ type: "text", text: JSON.stringify({ ok: true, products: service.searchProducts(query) }, null, 2) }],
}));

server.tool("search_product_knowledge", "Search product and policy documents with scoped RAG retrieval.", {
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(10).optional(),
}, async ({ query, top_k }) => ({
  content: [{ type: "text", text: JSON.stringify(service.searchProductKnowledge(query, top_k), null, 2) }],
}));

server.tool("get_logistics_status", "Query the latest logistics record for an order.", {
  order_id: z.string().min(1),
}, async ({ order_id }) => ({
  content: [{ type: "text", text: JSON.stringify(
    service.getLogistics(order_id)
      ? { ok: true, logistics: service.getLogistics(order_id) }
      : { ok: false, error: "logistics_source_not_configured" },
    null, 2,
  ) }],
}));

server.tool("get_order_detail", "Query a structured order record from the configured order source.", {
  order_id: z.string().min(1),
}, async ({ order_id }) => ({
  content: [{ type: "text", text: JSON.stringify(
    service.getOrder(order_id)
      ? { ok: true, order: service.getOrder(order_id) }
      : { ok: false, error: "order_source_not_configured" },
    null, 2,
  ) }],
}));

await server.connect(new StdioServerTransport());
void service.ready().catch((error) => {
  process.stderr.write(`commerce knowledge embedding failed: ${(error as Error).message}\n`);
});
process.once("SIGINT", () => {
  service.close();
  process.exit(0);
});
