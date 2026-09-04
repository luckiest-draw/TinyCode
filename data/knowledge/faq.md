# Frequently asked questions

This document is a fictional store FAQ written for demo and testing purposes.

## How do I check my order status?

Provide the order id. Order status is one of `processing`, `shipped`,
`delivered`, or `cancelled`.

- `processing` — payment approved, order being prepared.
- `shipped` — handed to the carrier, in transit.
- `delivered` — received by the customer.
- `cancelled` — cancelled before shipment; the total is refunded.

## What does "cancelled" mean on my order?

A cancelled order was stopped before shipment. The full order total is
refunded to the original payment method.

## Can I cancel an order that has shipped?

No. Once an order is `shipped` it cannot be cancelled. Wait for delivery and
start a return instead.

## How long does delivery take?

Delivery estimates depend on the shipping zone. Same-region shipments take 3
to 5 business days; cross-region shipments take 5 to 9 business days.

## How long does a refund take?

After a cancellation or accepted return, the refund appears within 3 to 7
business days depending on the payment method.

## How do I get the latest delivery update for my order?

Provide the order id to query the current logistics status and delivery
estimate.
