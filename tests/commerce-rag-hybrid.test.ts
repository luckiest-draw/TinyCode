import { describe, expect, it } from "vitest";
import { DeterministicEmbeddingProvider } from "../src/commerce/rag/embedding.js";
import { createRagDatabase, ingestDocumentWithEmbeddings, searchKnowledgeHybrid } from "../src/commerce/rag/store.js";

describe("hybrid commerce retrieval", () => {
  it("stores embeddings and combines semantic candidates with BM25", async () => {
    const db = createRagDatabase(":memory:");
    const embedding = new DeterministicEmbeddingProvider();
    await ingestDocumentWithEmbeddings(embedding, db, {
      documentId: "p-1", title: "商品说明", source: "p-1.md",
      text: "# 材质\n\n防泼水面料，适合冬季通勤。", scope: "commerce",
    });
    const result = await searchKnowledgeHybrid(embedding, db, "冬季面料", { scope: "commerce", topK: 2 });
    expect(result.mode).toBe("hybrid");
    expect(result.hits[0]).toMatchObject({ documentId: "p-1", source: "p-1.md" });
  });
});
