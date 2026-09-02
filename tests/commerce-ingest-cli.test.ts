import { describe, expect, it } from "vitest";
import { parseIngestArgs } from "../src/commerce/ingest-cli.js";

describe("commerce ingest CLI", () => {
  it("requires explicit knowledge and database paths", () => {
    expect(parseIngestArgs(["--knowledge", "./kb", "--db", "./data.sqlite"])).toEqual({
      knowledgeDirectory: "./kb",
      databasePath: "./data.sqlite",
    });
  });

  it("rejects missing paths", () => {
    expect(() => parseIngestArgs(["--knowledge", "./kb"])).toThrow(/--db/);
  });
});
