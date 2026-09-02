import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/agent/prompt.js";
import { buildCommercePrompt } from "../src/commerce/prompt.js";

describe("commerce prompt composition", () => {
  it("adds the commerce policy to TinyCode's base prompt without replacing it", () => {
    const prompt = [
      buildSystemPrompt({ projectRoot: "/workspace", platform: "test" }),
      buildCommercePrompt(),
    ].join("\n\n");
    expect(prompt).toContain("You are TinyCode");
    expect(prompt).toContain("Commerce Agent mode");
    expect(prompt).toContain("Never invent");
  });
});
