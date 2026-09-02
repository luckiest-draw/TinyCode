import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestKnowledgeDirectory } from "../src/commerce/ingest.js";
import { CommerceDataService } from "../src/commerce/service.js";

describe("commerce knowledge ingestion command", () => {
  it("builds a reusable SQLite knowledge database from caller data", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tinycode-ingest-"));
    const knowledge = path.join(root, "knowledge");
    const database = path.join(root, "commerce.sqlite");
    try {
      mkdirSync(knowledge);
      writeFileSync(path.join(knowledge, "product.md"), "# 规格\n\n支持机洗。", "utf8");
      expect(ingestKnowledgeDirectory(knowledge, database)).toEqual({ documents: 1, chunks: 1 });
      const service = new CommerceDataService({ ragDatabasePath: database });
      const result = service.searchProductKnowledge("机洗");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.hits[0]?.text).toContain("机洗");
      service.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
