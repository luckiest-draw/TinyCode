export type TextChunk = { section: string; text: string };

function heading(line: string): string | undefined {
  const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line.trim());
  return match?.[2];
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/[ \t]{2,}/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string, options: { size?: number; overlap?: number } = {}): TextChunk[] {
  const size = Math.max(1, options.size ?? 400);
  const overlap = Math.min(Math.max(0, options.overlap ?? 50), size - 1);
  const chunks: TextChunk[] = [];
  let section = "";
  let body: string[] = [];

  const flush = () => {
    const value = body.join("\n").trim();
    if (!value) {
      body = [];
      return;
    }
    if (value.length <= size) {
      chunks.push({ section, text: value });
    } else {
      let start = 0;
      while (start < value.length) {
        const end = Math.min(start + size, value.length);
        const piece = value.slice(start, end).trim();
        if (piece) chunks.push({ section, text: piece });
        if (end >= value.length) break;
        start = end - overlap;
      }
    }
    body = [];
  };

  for (const line of normalizeText(text).split("\n")) {
    const nextSection = heading(line);
    if (nextSection !== undefined) {
      flush();
      section = nextSection;
    } else {
      body.push(line);
    }
  }
  flush();
  return chunks;
}
