import { isAlreadyExists } from "./validation.js";

export type SaveOutcome =
  | { kind: "saved" }
  /** Another request with the same idempotency key already saved this order. Nothing to refund. */
  | { kind: "duplicate"; orderNumber?: string }
  /** The order could not be saved. `refunded` says whether the automatic refund went through. */
  | { kind: "failed"; refunded: boolean };

/**
 * The customer has already been charged. Save the order; if that fails, refund.
 *
 * The one exception: "already exists" means a concurrent request with the SAME
 * idempotency key got there first (Square returns the same payment to both calls),
 * so the order IS saved. Refunding then would hand the customer their money back
 * for an order they still receive, so it returns the existing order instead.
 */
export async function saveOrderOrRefund(deps: {
  create: () => Promise<unknown>;
  loadExistingOrderNumber: () => Promise<string | undefined>;
  refund: () => Promise<boolean>;
  log?: (error: unknown) => void;
}): Promise<SaveOutcome> {
  try {
    await deps.create();
    return { kind: "saved" };
  } catch (error) {
    if (isAlreadyExists(error)) {
      return { kind: "duplicate", orderNumber: await deps.loadExistingOrderNumber() };
    }
    deps.log?.(error);
    return { kind: "failed", refunded: await deps.refund() };
  }
}
