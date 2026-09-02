import { describe, expect, it } from "vitest";
import { chunkText, normalizeText } from "../src/commerce/rag/clean.js";
import { createRagDatabase, ingestDocument, searchKnowledge } from "../src/commerce/rag/store.js";

describe("commerce RAG", () => {
  it("normalizes text and keeps heading sections while chunking", () => {
    const text = normalizeText("# 商品规格\n\n材质：羽绒。\n\n\n## 清洗后\n适合冬季使用。  ");
    const chunks = chunkText(text, { size: 100, overlap: 10 });

    expect(chunks).toEqual([
      { section: "商品规格", text: "材质：羽绒。" },
      { section: "清洗后", text: "适合冬季使用。" },
    ]);
  });

  it("ingests documents and returns scoped BM25 hits with provenance", () => {
    const db = createRagDatabase(":memory:");
    ingestDocument(db, {
      documentId: "product-1",
      title: "商品说明",
      source: "products/product-1.md",
      text: "# 保暖说明\n\n这款羽绒服适合寒冷冬季通勤。\n\n# 清洗\n\n建议轻柔手洗。",
      scope: "commerce",
    });

    const result = searchKnowledge(db, "羽绒服 冬季", { scope: "commerce", topK: 2 });

    expect(result.mode).toBe("bm25");
    expect(result.hits[0]).toMatchObject({
      documentId: "product-1",
      section: "保暖说明",
      source: "products/product-1.md",
    });
  });

  it("does not return documents from another scope", () => {
    const db = createRagDatabase(":memory:");
    ingestDocument(db, {
      documentId: "private-1",
      title: "内部规则",
      source: "private.md",
      text: "退款审批仅限内部员工查看。",
      scope: "internal",
    });

    expect(searchKnowledge(db, "退款审批", { scope: "commerce", topK: 3 }).hits).toEqual([]);
  });
});
