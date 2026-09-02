import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRagDatabase, ingestDocument } from "./rag/store.js";

export function ingestKnowledgeDirectory(directory: string, databasePath: string): { documents: number; chunks: number } {
  const db = createRagDatabase(databasePath);
  let documents = 0;
  let chunks = 0;
  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) continue;
      const text = readFileSync(path.join(directory, entry.name), "utf8");
      const before = Number(db.prepare("SELECT COUNT(*) AS count FROM rag_chunks").get()?.count ?? 0);
      ingestDocument(db, {
        documentId: `file:${entry.name}`,
        title: entry.name,
        source: entry.name,
        text,
        scope: "commerce",
      });
      const after = Number(db.prepare("SELECT COUNT(*) AS count FROM rag_chunks").get()?.count ?? 0);
      documents += 1;
      chunks += after - before;
    }
    return { documents, chunks };
  } finally {
    db.close();
  }
}
