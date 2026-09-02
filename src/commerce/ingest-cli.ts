export type IngestArgs = { knowledgeDirectory: string; databasePath: string };

export function parseIngestArgs(argv: readonly string[]): IngestArgs {
  let knowledgeDirectory: string | undefined;
  let databasePath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--knowledge") knowledgeDirectory = value;
    else if (flag === "--db") databasePath = value;
    else throw new Error(`Unknown option: ${flag}`);
    index += 1;
  }
  if (!knowledgeDirectory) throw new Error("--knowledge requires a directory");
  if (!databasePath) throw new Error("--db requires a database path");
  return { knowledgeDirectory, databasePath };
}
