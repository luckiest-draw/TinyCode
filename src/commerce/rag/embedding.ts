import { createHash } from "node:crypto";

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export class DashScopeEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey = process.env.DASHSCOPE_API_KEY?.trim() ?? "",
    private readonly model = process.env.DASHSCOPE_EMBEDDING_MODEL?.trim() || "text-embedding-v3",
    private readonly baseUrl = process.env.DASHSCOPE_BASE_URL?.trim() ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
  ) {}

  get enabled(): boolean {
    return this.apiKey.length > 0;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.enabled) throw new Error("DASHSCOPE_API_KEY is not configured");
    const output: number[][] = [];
    for (let index = 0; index < texts.length; index += 20) {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, input: texts.slice(index, index + 20) }),
      });
      if (!response.ok) throw new Error(`DashScope embedding failed (${response.status})`);
      const payload = await response.json() as { data?: Array<{ embedding?: number[] }> };
      const vectors = payload.data?.map((item) => item.embedding ?? []);
      if (!vectors || vectors.some((vector) => vector.length === 0)) {
        throw new Error("DashScope embedding returned an invalid response");
      }
      output.push(...vectors);
    }
    return output;
  }
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions = 64) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = new Array<number>(this.dimensions).fill(0);
      const digest = createHash("sha256").update(text).digest();
      for (let i = 0; i < digest.length; i++) vector[digest[i]! % this.dimensions] += 1;
      return vector;
    });
  }
}
