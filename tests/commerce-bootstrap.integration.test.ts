import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHarnessFromCli } from "../src/cli/commands.js";

const serverPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/commerce/mcp-server.js");

describe("commerce bootstrap integration", () => {
  it("loads commerce MCP from project configuration", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinycode-commerce-bootstrap-"));
    const configDir = path.join(root, ".tinycode");
    fs.mkdirSync(configDir);
    fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({
      mcpServers: {
        commerce: { command: process.execPath, args: [serverPath], timeoutMs: 30000 },
      },
    }));

    const harness = await buildHarnessFromCli({ cwd: root, mock: true });
    try {
      expect(harness.mcp?.statuses()[0]?.status).toBe("connected");
      expect(harness.tools.names()).toEqual(expect.arrayContaining([
        "get_product_detail",
        "search_products",
        "get_order_detail",
        "get_logistics_status",
        "search_product_knowledge",
      ]));
    } finally {
      await harness.shutdown();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});
