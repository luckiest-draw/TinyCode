import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommerceDataService } from "../src/commerce/service.js";

describe("CommerceDataService knowledge ingestion", () => {
  it("indexes caller-provided markdown files without bundling business content", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tinycode-commerce-"));
    try {
      writeFileSync(path.join(root, "product-guide.md"), "# 材质\n\n这款商品采用防泼水面料。", "utf8");
      const service = new CommerceDataService({ ragDatabasePath: ":memory:" });
      const count = service.ingestKnowledgeDirectory(root);

      expect(count).toBe(1);
      const result = service.searchProductKnowledge("防泼水");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.hits[0]).toMatchObject({
          source: "product-guide.md",
          section: "材质",
        });
      }
      service.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
