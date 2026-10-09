import { describe, expect, it, vi } from "vitest";
import { saveOrderOrRefund } from "./order-write.js";

// Firestore's error when create() hits a document that already exists.
const alreadyExists = () => Object.assign(new Error("6 ALREADY_EXISTS: Document already exists"), { code: 6 });

const deps = (over: Partial<Parameters<typeof saveOrderOrRefund>[0]> = {}) => ({
  create: vi.fn(async () => undefined),
  loadExistingOrderNumber: vi.fn(async () => "CG-123456"),
  refund: vi.fn(async () => true),
  log: vi.fn(),
  ...over,
});

describe("saveOrderOrRefund", () => {
  it("saves the order and does not refund", async () => {
    const d = deps();
    expect(await saveOrderOrRefund(d)).toEqual({ kind: "saved" });
    expect(d.refund).not.toHaveBeenCalled();
  });

  it("a concurrent duplicate (order already exists) returns the existing order and does NOT refund", async () => {
    // Two simultaneous requests with the same idempotency key: Square charges once and
    // returns the same payment to both; the second order write finds the order already saved.
    const d = deps({ create: vi.fn(async () => { throw alreadyExists(); }) });
    expect(await saveOrderOrRefund(d)).toEqual({ kind: "duplicate", orderNumber: "CG-123456" });
    expect(d.refund).not.toHaveBeenCalled();
    expect(d.log).not.toHaveBeenCalled();
  });

  it.each([[6], ["already-exists"], ["ALREADY_EXISTS"]])("treats error code %j as already-exists", async (code) => {
    const d = deps({ create: vi.fn(async () => { throw Object.assign(new Error("x"), { code }); }) });
    expect((await saveOrderOrRefund(d)).kind).toBe("duplicate");
    expect(d.refund).not.toHaveBeenCalled();
  });

  it("any other write failure refunds the customer", async () => {
    const d = deps({ create: vi.fn(async () => { throw Object.assign(new Error("unavailable"), { code: 14 }); }) });
    expect(await saveOrderOrRefund(d)).toEqual({ kind: "failed", refunded: true });
    expect(d.refund).toHaveBeenCalledTimes(1);
    expect(d.log).toHaveBeenCalledTimes(1);
  });

  it("an error with no code also refunds", async () => {
    const d = deps({ create: vi.fn(async () => { throw new Error("boom"); }) });
    expect(await saveOrderOrRefund(d)).toEqual({ kind: "failed", refunded: true });
  });

  it("reports when the refund itself failed, so the caller can tell the customer to get in touch", async () => {
    const d = deps({
      create: vi.fn(async () => { throw new Error("boom"); }),
      refund: vi.fn(async () => false),
    });
    expect(await saveOrderOrRefund(d)).toEqual({ kind: "failed", refunded: false });
  });

  it("a duplicate whose saved order cannot be read still does not refund", async () => {
    const d = deps({
      create: vi.fn(async () => { throw alreadyExists(); }),
      loadExistingOrderNumber: vi.fn(async () => undefined),
    });
    expect(await saveOrderOrRefund(d)).toEqual({ kind: "duplicate", orderNumber: undefined });
    expect(d.refund).not.toHaveBeenCalled();
  });
});
