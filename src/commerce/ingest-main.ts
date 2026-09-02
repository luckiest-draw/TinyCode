import { ingestKnowledgeDirectory } from "./ingest.js";
import { parseIngestArgs } from "./ingest-cli.js";

try {
  const result = ingestKnowledgeDirectory(...Object.values(parseIngestArgs(process.argv.slice(2))) as [string, string]);
  process.stdout.write(`ingested ${result.documents} documents and ${result.chunks} chunks\n`);
} catch (error) {
  process.stderr.write(`commerce ingest failed: ${(error as Error).message}\n`);
  process.exitCode = 1;
}
