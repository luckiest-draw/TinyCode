export type ProductRecord = {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  [key: string]: unknown;
};

export type CommerceCatalog = ReadonlyMap<string, ProductRecord>;

export function createCommerceCatalog(products: ProductRecord[]): CommerceCatalog {
  return new Map(products.map((product) => [product.id, { ...product }]));
}

export function findProduct(catalog: CommerceCatalog, id: string): ProductRecord | null {
  return catalog.get(id) ?? null;
}

export function searchProducts(catalog: CommerceCatalog, query: string): ProductRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return [...catalog.values()].filter((product) =>
    `${product.id} ${product.title} ${product.description}`.toLowerCase().includes(needle),
  );
}
