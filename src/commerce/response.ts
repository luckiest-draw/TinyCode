import { z } from "zod";

const baseResponse = {
  facts: z.array(z.string()),
  internal_note: z.string().default(""),
  pending_confirmation: z.array(z.string()).default([]),
};

export const customerServiceResponseSchema = z.object({
  task: z.literal("customer_service"),
  ...baseResponse,
  customer_reply: z.string().min(1),
});

export const operationsResponseSchema = z.object({
  task: z.literal("operations"),
  ...baseResponse,
  customer_reply: z.string().default(""),
  findings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  data_scope: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
});

export const commerceResponseSchema = z.discriminatedUnion("task", [
  customerServiceResponseSchema,
  operationsResponseSchema,
]);

export type CommerceResponse = z.infer<typeof commerceResponseSchema>;

export function parseCommerceResponse(value: unknown): CommerceResponse {
  return commerceResponseSchema.parse(value);
}
