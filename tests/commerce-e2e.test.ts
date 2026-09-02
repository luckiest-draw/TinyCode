import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join, resolve } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { bootstrapHarness, type Harness } from "../src/bootstrap.js";

describe("Commerce E2E", () => {
  let harness: Harness;
  let fixtureRoot: string;

  beforeAll(async () => {
    fixtureRoot = mkdtempSync(join(os.tmpdir(), "tinycode-commerce-e2e-"));
    const knowledgeDirectory = join(fixtureRoot, "knowledge");
    mkdirSync(knowledgeDirectory);
    const ordersPath = join(fixtureRoot, "orders.json");
    const logisticsPath = join(fixtureRoot, "logistics.json");
    const ragDatabasePath = join(fixtureRoot, "knowledge.sqlite");
    writeFileSync(ordersPath, JSON.stringify([{ id: "ORD001", status: "shipped", total: 399 }]));
    writeFileSync(logisticsPath, JSON.stringify([{ order_id: "ORD001", status: "派送中", tracking_number: "SF001" }]));
    writeFileSync(join(knowledgeDirectory, "return-policy.md"), "# 退换货政策\n\n商品签收后七天内支持退换货。", "utf8");

    const serverPath = resolve(fileURLToPath(new URL("../dist/commerce/mcp-server.js", import.meta.url)));
    harness = await bootstrapHarness({
      projectRoot: fixtureRoot,
      config: {
        permissionMode: "auto",
        mcpServers: {
          commerce: {
            command: process.execPath,
            args: [serverPath],
            env: {
              TINYCODE_COMMERCE_ORDERS: ordersPath,
              TINYCODE_COMMERCE_LOGISTICS: logisticsPath,
              TINYCODE_COMMERCE_RAG_DB: ragDatabasePath,
              TINYCODE_COMMERCE_KNOWLEDGE_DIR: knowledgeDirectory,
            },
            timeoutMs: 30000,
          },
        },
      },
      mock: true,
    });
    expect(harness.mcp?.statuses()[0]?.status).toBe("connected");
  }, 30000);

  afterAll(async () => {
    await harness?.shutdown();
    if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("should query order and logistics information", async () => {
    harness.models.mockHandle!.setResponses([
      fauxAssistantMessage([
        fauxToolCall("get_order_detail", { order_id: "ORD001" }),
        fauxToolCall("get_logistics_status", { order_id: "ORD001" }),
      ]),
      fauxAssistantMessage("订单 ORD001 状态为 shipped，物流状态为派送中。"),
    ]);

    await harness.runtime.prompt("查询订单 ORD001 的状态和物流信息");
    const lastMessage = harness.runtime.agent.state.messages.at(-1);
    expect(lastMessage).toBeDefined();
    expect(lastMessage!.role).toBe("assistant");
    const responseText = lastMessage!.role === "assistant"
      ? lastMessage!.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("")
      : "";
    expect(responseText).toContain("ORD001");
    expect(responseText).toContain("shipped");
    expect(responseText).toContain("派送中");
  }, 15000);

  it("should search product knowledge", async () => {
    harness.models.mockHandle!.setResponses([
      fauxAssistantMessage([fauxToolCall("search_product_knowledge", { query: "退换货政策" })]),
      fauxAssistantMessage("退换货政策：签收后七天内支持退换货。"),
    ]);

    await harness.runtime.prompt("搜索退换货政策相关知识");
    const lastMessage = harness.runtime.agent.state.messages.at(-1);
    expect(lastMessage).toBeDefined();
    expect(lastMessage!.role).toBe("assistant");
    const responseText = lastMessage!.role === "assistant"
      ? lastMessage!.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("")
      : "";
    expect(responseText).toContain("退换货");
  }, 15000);
});
