import { describe, expect, it } from "vitest";
import { createCommerceCatalog, findProduct, searchProducts } from "../src/commerce/catalog.js";

describe("commerce catalog", () => {
  it("loads product records from caller-provided JSON without bundling business data", () => {
    const catalog = createCommerceCatalog([
      { id: "p-1", title: "轻薄羽绒服", description: "冬季通勤", price: 399, stock: 8 },
    ]);

    expect(findProduct(catalog, "p-1")).toMatchObject({ id: "p-1", price: 399 });
    expect(searchProducts(catalog, "羽绒")).toHaveLength(1);
  });

  it("returns no product for an unknown id instead of inventing facts", () => {
    const catalog = createCommerceCatalog([]);
    expect(findProduct(catalog, "missing")).toBeNull();
  });
});
