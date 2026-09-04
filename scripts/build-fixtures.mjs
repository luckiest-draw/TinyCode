#!/usr/bin/env node
/**
 * Build TinyCode Commerce demo fixtures from the upstream CC0 synthetic
 * e-commerce dataset.
 *
 * Source:
 *   https://github.com/ablancogcr/synthetic-dataset-generator
 *   data/sample_output/ecommerce_baseline_10000_seed42/   (CC0 1.0)
 *
 * We commit only the generated JSON fixtures (data/products.json,
 * data/orders.json, data/logistics.json), not the upstream CSV files. Run
 * this script to regenerate them from a local clone of the upstream repo:
 *
 *   git clone --depth 1 \
 *     https://github.com/ablancogcr/synthetic-dataset-generator.git /tmp/synth-repo
 *   node scripts/build-fixtures.mjs --input /tmp/synth-repo/data/sample_output/ecommerce_baseline_10000_seed42
 *
 * Output schema matches what src/commerce/service.ts loads:
 *   products  -> array of { id, title, description, price, stock }
 *   orders    -> array of { id, status, ... }        (order records)
 *   logistics -> array of { order_id, ... }          (logistics records)
 *
 * Field provenance:
 *   - id/title/price/status/dates/regions/...  copied from upstream.
 *   - description and stock are NOT in the upstream schema and are derived
 *     deterministically here (documented in data/SOURCE.md). Everything is
 *     synthetic demo data under CC0.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const here = new URL(".", import.meta.url);

function arg(name, fallback) {
  const flag = `--${name}`;
  const at = process.argv.indexOf(flag);
  return at !== -1 ? process.argv[at + 1] : fallback;
}

const inputDir = resolve(arg("input", ""));
if (!inputDir) {
  process.stderr.write("usage: node scripts/build-fixtures.mjs --input <upstream-seed42-dir>\n");
  process.exit(2);
}

function parseCsv(filename) {
  const text = readFileSync(join(inputDir, filename), "utf8");
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.length > 0);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((header, i) => (row[header] = (cells[i] ?? "").trim()));
    return row;
  });
}

const products = parseCsv("products.csv");
const orders = parseCsv("orders.csv");
const orderItems = parseCsv("order_items.csv");
const shipping = parseCsv("shipping.csv");
const payments = parseCsv("payments.csv");

/** Deterministic small-positive int from a string (stock stand-in). */
function stableHashInt(text, bound) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % bound;
}

const productById = new Map(products.map((p) => [p.product_id, p]));

const itemByOrder = new Map();
for (const item of orderItems) {
  if (!itemByOrder.has(item.order_id)) itemByOrder.set(item.order_id, []);
  itemByOrder.get(item.order_id).push(item);
}
const shippingByOrder = new Map(shipping.map((s) => [s.order_id, s]));
const firstPaymentByOrder = new Map();
for (const p of payments) {
  if (!firstPaymentByOrder.has(p.order_id)) firstPaymentByOrder.set(p.order_id, p);
}

function deriveDeliveryStatus(order, ship) {
  if (order.order_status === "cancelled") return "cancelled";
  if (order.order_delivered_customer_date) return "delivered";
  if (order.order_delivered_carrier_date) return "in_transit";
  if (ship?.actual_delivery_days) return "delivered";
  return "processing";
}

function pickOrderSubset() {
  const quotas = { cancelled: 60, shipped: 40, processing: 40, delivered: 80 };
  const picked = [];
  const used = new Set();
  for (const order of orders) {
    const status = order.order_status;
    if (!(status in quotas)) continue;
    if ((quotas[status] ?? 0) <= 0) continue;
    quotas[status] -= 1;
    picked.push(order);
    used.add(order.order_id);
  }
  return { picked, used };
}

const { picked, used } = pickOrderSubset();

// Product subset: referenced by picked orders, plus the first few dozen for browsing.
const referenced = new Set();
for (const order of picked) {
  for (const item of itemByOrder.get(order.order_id) ?? []) referenced.add(item.product_id);
}
for (const p of products.slice(0, 60)) referenced.add(p.product_id);

const keptProducts = products.filter((p) => referenced.has(p.product_id));
const productOut = keptProducts.map((p) => ({
  id: p.product_id,
  title: p.product_name,
  description: `${p.product_category} — synthetic demo listing "${p.product_name}".`,
  price: Number(p.product_price_base_usd),
  stock: stableHashInt(p.product_id, 180),
}));

const ordersOut = picked.map((o) => {
  const items = itemByOrder.get(o.order_id) ?? [];
  const payment = firstPaymentByOrder.get(o.order_id);
  const lines = items.map((item) => {
    const prod = productById.get(item.product_id);
    return {
      product_id: item.product_id,
      product_title: prod ? prod.product_name : null,
      unit_price: Number(item.item_price_usd),
      line_total: Number(item.item_total_usd),
    };
  });
  return {
    id: o.order_id,
    status: o.order_status,
    purchased_at: o.order_purchase_timestamp || undefined,
    total: Number(lines.reduce((sum, l) => sum + (Number.isFinite(l.line_total) ? l.line_total : 0), 0).toFixed(2)),
    currency: "USD",
    items: lines,
    payment: payment
      ? { type: payment.payment_type, installments: Number(payment.payment_installments ?? 1) }
      : undefined,
  };
});

const logisticsOut = picked
  .map((o) => {
    const ship = shippingByOrder.get(o.order_id);
    if (!ship) return null;
    return {
      order_id: o.order_id,
      delivery_status: deriveDeliveryStatus(o, ship),
      seller_region: ship.seller_region || undefined,
      customer_region: ship.customer_region || undefined,
      shipping_zone: ship.shipping_zone || undefined,
      distance_band: ship.shipping_distance_band || undefined,
      estimated_delivery_days: ship.estimated_delivery_days === "" ? undefined : Number(ship.estimated_delivery_days),
      actual_delivery_days: ship.actual_delivery_days === "" ? undefined : Number(ship.actual_delivery_days),
      delivery_delay_days: ship.delivery_delay_days === "" ? undefined : Number(ship.delivery_delay_days),
      late_delivery_flag: ship.late_delivery_flag === "True",
      shipping_cost_usd: Number(ship.shipping_cost_usd),
    };
  })
  .filter(Boolean);

const outDir = join(root, "data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "products.json"), `${JSON.stringify(productOut, null, 2)}\n`);
writeFileSync(join(outDir, "orders.json"), `${JSON.stringify(ordersOut, null, 2)}\n`);
writeFileSync(join(outDir, "logistics.json"), `${JSON.stringify(logisticsOut, null, 2)}\n`);

const summary = {
  source: inputDir,
  products: productOut.length,
  orders: ordersOut.length,
  logistics: logisticsOut.length,
  orderStatuses: Object.fromEntries(
    [...new Set(ordersOut.map((o) => o.status))].sort().map((s) => [s, ordersOut.filter((o) => o.status === s).length]),
  ),
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`wrote ${outDir}\n`);
