# Data source & provenance

The JSON fixtures in this directory are **synthetic demo data**, converted from
the CC0-licensed sample output of an open-source e-commerce data generator.
They are not real customers, orders, shipments, or store policies.

## Upstream

| Field | Value |
|---|---|
| Repository | https://github.com/ablancogcr/synthetic-dataset-generator |
| Commit used | `b7ddadf3133d0f4fb326c016c9e11111fa30ef7c` (2026-07-17) |
| Sample directory | `data/sample_output/ecommerce_baseline_10000_seed42/` |
| Data license | **CC0 1.0 Universal** — see [`LICENSE-DATA`](./LICENSE-DATA) |
| Code license | MIT (upstream generator source) |

The upstream sample contains 10,000 orders, ~8,000 products, ~16.8k order
items, and per-order payment + shipping records. Statuses include
`delivered`, `shipped`, `processing`, and `cancelled`.

## What we commit vs. regenerate

Only the generated JSON fixtures are committed:

- `products.json`
- `orders.json`
- `logistics.json`
- `knowledge/*.md` (project-authored synthetic policy documents)

The upstream CSV files are **not** committed (they are multi-megabyte). Regenerate
the fixtures from a local clone of the upstream repository:

```bash
git clone --depth 1 \
  https://github.com/ablancogcr/synthetic-dataset-generator.git /tmp/synth-repo
node scripts/build-fixtures.mjs \
  --input /tmp/synth-repo/data/sample_output/ecommerce_baseline_10000_seed42
```

The script writes the three JSON files above. See `scripts/build-fixtures.mjs`
for the exact field mapping.

## Deterministic subset

`scripts/build-fixtures.mjs` keeps a small, deterministic subset so the repo
stays light while still covering every order status:

| status | count |
|---|---|
| cancelled | 60 |
| delivered | 80 |
| shipped | 40 |
| processing | 40 |
| **orders total** | **220** |

Products include every product referenced by those orders plus the first 60
catalog entries (394 products total). Logistics records mirror the 220 orders.

## Field mapping & derivations

Copied (as-is) from upstream:

- products → `id` (`product_id`), `title` (`product_name`), `price`
  (`product_price_base_usd`)
- orders → `id` (`order_id`), `status` (`order_status`), `purchased_at`
  (`order_purchase_timestamp`); nested `items` are aggregated from
  `order_items.csv`; `payment` is the first payment row from `payments.csv`;
  `total` is the summed item total in USD.
- logistics → `order_id`, `seller_region`, `customer_region`, `shipping_zone`,
  `distance_band`, `estimated_delivery_days`, `actual_delivery_days`,
  `delivery_delay_days`, `late_delivery_flag`, `shipping_cost_usd`
  (all from `shipping.csv`).

Derived deterministically (not in the upstream schema; documented for honesty):

- `description` — constructed from the upstream `product_category` and
  `product_name`, so `search_products` has text to match.
- `stock` — a stable integer derived from a hash of `product_id`
  (upstream has no stock column).
- logistics `delivery_status` — inferred from the order status and the
  presence of carrier/customer delivery timestamps (`cancelled` /
  `in_transit` / `delivered` / `processing`).
- `currency: "USD"` — the generator prices its sample in USD.

## Knowledge documents

`knowledge/*.md` are **project-authored, fictional store policies** written
from scratch so the RAG demo has safe, clearly synthetic content. They do not
reproduce any real retailer's terms. They are built into a local SQLite RAG
index at runtime via the commerce ingest tooling:

```bash
npm run commerce:ingest -- --knowledge ./data/knowledge --db ./data/commerce.sqlite
```

## License

The converted JSON retains the upstream CC0 terms and adds no new rights
restrictions; see [`LICENSE-DATA`](./LICENSE-DATA). The conversion script in
`scripts/` is MIT, like the rest of this repository.
