import type { CommerceDataService } from "./service.js";

export type CommerceToolArgs = {
  get_product_detail: { product_id: string };
  search_products: { query: string };
  search_product_knowledge: { query: string; top_k?: number };
  search_orders: { status?: string; limit?: number };
  get_order_detail: { order_id: string };
  get_logistics_status: { order_id: string };
};

export function createCommerceMcpTools(service: CommerceDataService) {
  return {
    get_product_detail: async ({ product_id }: CommerceToolArgs["get_product_detail"]) => {
      const product = service.getProduct(product_id);
      return product ? { ok: true as const, product } : { ok: false as const, error: "product_not_found" as const };
    },
    search_products: async ({ query }: CommerceToolArgs["search_products"]) => ({
      ok: true as const,
      products: service.searchProducts(query),
    }),
    search_product_knowledge: async ({ query, top_k }: CommerceToolArgs["search_product_knowledge"]) =>
      service.searchProductKnowledgeAsync(query, top_k),
    search_orders: async ({ status, limit }: CommerceToolArgs["search_orders"]) => {
      const orders = service.searchOrders({ status, limit });
      return orders.length > 0
        ? { ok: true as const, count: orders.length, orders }
        : { ok: false as const, error: status ? `no orders with status "${status}"` as const : "order_source_not_configured" as const };
    },
    get_order_detail: async ({ order_id }: CommerceToolArgs["get_order_detail"]) => {
      const order = service.getOrder(order_id);
      return order ? { ok: true as const, order } : { ok: false as const, error: "order_source_not_configured" as const };
    },
    get_logistics_status: async ({ order_id }: CommerceToolArgs["get_logistics_status"]) => {
      const logistics = service.getLogistics(order_id);
      return logistics ? { ok: true as const, logistics } : { ok: false as const, error: "logistics_source_not_configured" as const };
    },
  };
}
