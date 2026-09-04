import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createCommerceCatalog, findProduct, searchProducts, type ProductRecord } from "./catalog.js";
import { createRagDatabase, ingestDocument, ingestDocumentWithEmbeddings, searchKnowledge, searchKnowledgeHybrid, type RagDatabase } from "./rag/store.js";
import { DashScopeEmbeddingProvider, type EmbeddingProvider } from "./rag/embedding.js";

export type CommerceDataSources = {
  productsPath?: string;
  ragDatabasePath?: string;
  knowledgeDirectory?: string;
  ordersPath?: string;
  logisticsPath?: string;
  orders?: OrderRecord[];
  logistics?: LogisticsRecord[];
};

export type OrderRecord = { id: string; [key: string]: unknown };
export type LogisticsRecord = { order_id: string; [key: string]: unknown };

export class CommerceDataService {
  readonly catalog;
  readonly ragDatabase: RagDatabase | null;
  private readonly orders: ReadonlyMap<string, OrderRecord>;
  private readonly logistics: ReadonlyMap<string, LogisticsRecord>;
  private readonly embedding: EmbeddingProvider;
  private readonly knowledgeDirectory?: string;

  constructor(sources: CommerceDataSources = {}) {
    this.catalog = createCommerceCatalog(loadProducts(sources.productsPath));
    this.ragDatabase = sources.ragDatabasePath ? createRagDatabase(sources.ragDatabasePath) : null;
    this.embedding = new DashScopeEmbeddingProvider();
    this.knowledgeDirectory = sources.knowledgeDirectory;
    this.orders = new Map((sources.orders ?? loadRecords<OrderRecord>(sources.ordersPath, "orders")).map((order) => [order.id, { ...order }]));
    this.logistics = new Map((sources.logistics ?? loadRecords<LogisticsRecord>(sources.logisticsPath, "logistics")).map((record) => [record.order_id, { ...record }]));
    if (this.ragDatabase && sources.knowledgeDirectory) this.ingestKnowledgeDirectory(sources.knowledgeDirectory);
  }

  async ready(): Promise<void> {
    if (!this.ragDatabase || !this.knowledgeDirectory || !(this.embedding instanceof DashScopeEmbeddingProvider) || !this.embedding.enabled) return;
    for (const entry of readdirSync(this.knowledgeDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
      await ingestDocumentWithEmbeddings(this.embedding, this.ragDatabase, {
        documentId: `file:${entry.name}`,
        title: entry.name,
        source: entry.name,
        text: readFileSync(path.join(this.knowledgeDirectory, entry.name), "utf8"),
        scope: "commerce",
      });
    }
  }

  getProduct(id: string): ProductRecord | null {
    return findProduct(this.catalog, id);
  }

  searchProducts(query: string): ProductRecord[] {
    return searchProducts(this.catalog, query);
  }

  getOrder(id: string): OrderRecord | null {
    return this.orders.get(id) ?? null;
  }

  /** Search order records by an optional status filter (case-insensitive). */
  searchOrders(filter?: { status?: string; limit?: number }): OrderRecord[] {
    let records = [...this.orders.values()];
    const status = filter?.status?.trim().toLowerCase();
    if (status) {
      records = records.filter((order) => String(order.status ?? "").toLowerCase() === status);
    }
    const limit = Math.min(Math.max(1, filter?.limit ?? 50), 100);
    return records.slice(0, limit);
  }

  getLogistics(orderId: string): LogisticsRecord | null {
    return this.logistics.get(orderId) ?? null;
  }

  searchProductKnowledge(query: string, topK = 4) {
    if (!this.ragDatabase) {
      return { ok: false as const, error: "knowledge_base_not_configured" as const };
    }
    return {
      ok: true as const,
      ...searchKnowledge(this.ragDatabase, query, { scope: "commerce", topK }),
    };
  }

  async searchProductKnowledgeAsync(query: string, topK = 4) {
    if (!this.ragDatabase) {
      return { ok: false as const, error: "knowledge_base_not_configured" as const };
    }
    if (this.embedding instanceof DashScopeEmbeddingProvider && this.embedding.enabled) {
      return { ok: true as const, ...await searchKnowledgeHybrid(this.embedding, this.ragDatabase, query, { scope: "commerce", topK }) };
    }
    return { ok: true as const, ...searchKnowledge(this.ragDatabase, query, { scope: "commerce", topK }) };
  }

  ingestKnowledgeDirectory(directory: string): number {
    if (!this.ragDatabase) throw new Error("RAG database is not configured");
    let count = 0;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
      const source = path.join(directory, entry.name);
      ingestDocument(this.ragDatabase, {
        documentId: `file:${entry.name}`,
        title: entry.name,
        source: entry.name,
        text: readFileSync(source, "utf8"),
        scope: "commerce",
      });
      count += 1;
    }
    return count;
  }

  close(): void {
    this.ragDatabase?.close();
  }
}

function loadRecords<T extends Record<string, unknown>>(recordsPath: string | undefined, label: string): T[] {
  if (!recordsPath) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(recordsPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to load commerce ${label} from ${recordsPath}: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`Commerce ${label} file must contain a JSON array`);
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Invalid ${label} record at index ${index}`);
    return item as T;
  });
}

function loadProducts(productsPath?: string): ProductRecord[] {
  if (!productsPath) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(productsPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to load commerce products from ${productsPath}: ${(error as Error).message}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Commerce products file must contain a JSON array");
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Invalid product at index ${index}`);
    const product = item as Record<string, unknown>;
    if (typeof product.id !== "string" || typeof product.title !== "string" ||
        typeof product.description !== "string" || typeof product.price !== "number" ||
        typeof product.stock !== "number") {
      throw new Error(`Product at index ${index} requires id, title, description, price and stock`);
    }
    return product as ProductRecord;
  });
}
