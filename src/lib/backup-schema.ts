import { z } from "zod";

const integer = z.number().int().safe();
const timestamp = integer.nonnegative();
const id = z.string().min(1).max(200);
const syncFields = {
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
};

// Records keep unknown fields so data written by newer app versions survives older parsers.
export const backupSchema = z.object({
  app: z.literal("orange-finance"),
  version: z.literal(1),
  exportedAt: z.string(),
  accounts: z.array(z.looseObject({
    ...syncFields,
    name: z.string(),
    type: z.enum(["checking", "savings", "wallet", "credit", "investment"]),
    color: z.string(),
    initialBalance: integer,
    creditLimit: integer.nullable(),
  })),
  categories: z.array(z.looseObject({
    ...syncFields,
    name: z.string(),
    kind: z.enum(["expense", "income"]),
    color: z.string(),
    icon: z.string(),
  })),
  transactions: z.array(z.looseObject({
    ...syncFields,
    type: z.enum(["expense", "income", "transfer"]),
    amount: integer.nonnegative(),
    description: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    accountId: id,
    toAccountId: id.nullable(),
    categoryId: id.nullable(),
    paid: z.boolean(),
    notes: z.string(),
    groupId: id.nullable(),
    installment: integer.positive().nullable(),
    installments: integer.positive().nullable(),
    /** User who owns the entry in a shared space; null for personal spaces and entries created before 1.0. */
    holderId: id.nullable().default(null),
  })),
  budgets: z.array(z.looseObject({
    ...syncFields,
    categoryId: id,
    amount: integer.nonnegative(),
  })),
  settings: z.array(z.object({ key: z.string(), value: z.unknown() })),
});
