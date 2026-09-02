import { DatabaseSync } from "node:sqlite";
import { chunkText } from "./clean.js";
import type { EmbeddingProvider } from "./embedding.js";

export type RagDatabase = DatabaseSync;
export type RagDocument = {
  documentId: string;
  title: string;
  source: string;
  text: string;
  scope: string;
};
export type RagHit = {
  documentId: string;
  title: string;
  source: string;
  section: string;
  text: string;
  score: number;
};

export function createRagDatabase(filename = ":memory:"): RagDatabase {
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      document_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      scope TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rag_chunks (
      chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL REFERENCES rag_documents(document_id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      section TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_scope ON rag_chunks(scope);
  `);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export async function ingestDocumentWithEmbeddings(
  embedding: EmbeddingProvider,
  db: RagDatabase,
  document: RagDocument,
): Promise<void> {
  const chunks = chunkText(document.text);
  if (chunks.length === 0) throw new Error("Document has no searchable text");
  const vectors = await embedding.embed(chunks.map((chunk) => chunk.text));
  if (vectors.length !== chunks.length) throw new Error("Embedding count does not match chunk count");
  const hash = simpleHash(document.text);
  db.prepare(`
    INSERT INTO rag_documents(document_id, title, source, scope, content_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET title=excluded.title, source=excluded.source,
      scope=excluded.scope, content_hash=excluded.content_hash, created_at=excluded.created_at
  `).run(document.documentId, document.title, document.source, document.scope, hash, new Date().toISOString());
  db.prepare("DELETE FROM rag_chunks WHERE document_id = ?").run(document.documentId);
  const insert = db.prepare(`INSERT INTO rag_chunks(document_id, scope, section, chunk_index, text, embedding) VALUES (?, ?, ?, ?, ?, ?)`);
  chunks.forEach((chunk, index) => insert.run(document.documentId, document.scope, chunk.section, index, chunk.text, JSON.stringify(vectors[index])));
}

export async function searchKnowledgeHybrid(
  embedding: EmbeddingProvider,
  db: RagDatabase,
  query: string,
  options: { scope: string; topK?: number },
): Promise<{ mode: "hybrid"; hits: RagHit[] }> {
  const vector = (await embedding.embed([query]))[0];
  if (!vector) return { mode: "hybrid", hits: [] };
  const rows = db.prepare(`SELECT c.document_id AS documentId, d.title, d.source, c.section, c.text, c.embedding FROM rag_chunks c JOIN rag_documents d ON d.document_id = c.document_id WHERE c.scope = ?`).all(options.scope) as Array<Omit<RagHit, "score"> & { embedding: string | null }>;
  const queryTokens = tokenize(query);
  const ranked = rows.map((row) => ({ ...row, score: 0.5 * cosine(vector, parseEmbedding(row.embedding)) + 0.5 * Math.min(bm25(queryTokens, tokenize(row.text)), 1) }))
    .sort((a, b) => b.score - a.score).slice(0, options.topK ?? 4).map(({ embedding: _embedding, score, ...row }) => ({ ...row, score: Number(score.toFixed(4)) }));
  return { mode: "hybrid", hits: ranked };
}

function parseEmbedding(value: string | null): number[] {
  try { return value ? (JSON.parse(value) as number[]) : []; } catch { return []; }
}

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i]! * b[i]!; aa += a[i]! * a[i]!; bb += b[i]! * b[i]!; }
  return aa && bb ? Math.max(0, dot / Math.sqrt(aa * bb)) : 0;
}

export function ingestDocument(db: RagDatabase, document: RagDocument): void {
  const chunks = chunkText(document.text);
  if (chunks.length === 0) throw new Error("Document has no searchable text");
  const hash = simpleHash(document.text);
  db.prepare(`
    INSERT INTO rag_documents(document_id, title, source, scope, content_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET
      title=excluded.title, source=excluded.source, scope=excluded.scope,
      content_hash=excluded.content_hash, created_at=excluded.created_at
  `).run(document.documentId, document.title, document.source, document.scope, hash, new Date().toISOString());
  db.prepare("DELETE FROM rag_chunks WHERE document_id = ?").run(document.documentId);
  const insert = db.prepare(`
    INSERT INTO rag_chunks(document_id, scope, section, chunk_index, text)
    VALUES (?, ?, ?, ?, ?)
  `);
  chunks.forEach((chunk, index) => insert.run(document.documentId, document.scope, chunk.section, index, chunk.text));
}

export function searchKnowledge(
  db: RagDatabase,
  query: string,
  options: { scope: string; topK?: number },
): { mode: "bm25"; hits: RagHit[] } {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { mode: "bm25", hits: [] };
  const rows = db.prepare(`
    SELECT c.document_id AS documentId, d.title, d.source, c.section, c.text
    FROM rag_chunks c JOIN rag_documents d ON d.document_id = c.document_id
    WHERE c.scope = ?
  `).all(options.scope) as Array<Omit<RagHit, "score">>;
  const scored = rows.map((row) => ({ ...row, score: bm25(tokens, tokenize(row.text)) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.topK ?? 4)
    .map((row) => ({ ...row, score: Number(row.score.toFixed(4)) }));
  return { mode: "bm25", hits: scored };
}

function tokenize(text: string): string[] {
  const words: string[] = [];
  for (const segment of text.toLowerCase().split(/[\s，。！？、；：,.!?;:()[\]{}]+/)) {
    if (!segment) continue;
    if (/^[a-z0-9_-]+$/.test(segment)) words.push(segment);
    else for (let size = 2; size <= Math.min(6, segment.length); size++) {
      for (let i = 0; i + size <= segment.length; i += Math.max(1, size - 1)) words.push(segment.slice(i, i + size));
    }
  }
  return [...new Set(words)];
}

function bm25(query: string[], document: string[]): number {
  const counts = new Map<string, number>();
  document.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  const uniqueQuery = [...new Set(query)];
  const averageLength = Math.max(document.length, 1);
  return uniqueQuery.reduce((score, token) => {
    const frequency = counts.get(token) ?? 0;
    if (frequency === 0) return score;
    const lengthNorm = 1.5 * (1 - 0.75 + 0.75 * document.length / averageLength);
    return score + (frequency * 2.5) / (frequency + lengthNorm);
  }, 0);
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
