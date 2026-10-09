import { describe, expect, it } from "vitest";
import { isAlreadyExists, isValidEmail, isValidMenuItemId, singleLine } from "./validation.js";

describe("isValidEmail", () => {
  it.each([
    "a@b.co",
    "chloe@example.com",
    "first.last+orders@mail.example.co.uk",
    "o'brien@example.com",
    "user_name-1@sub.domain.org",
    "UPPER@EXAMPLE.COM",
  ])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    "",
    "plain",
    "no-at.example.com",
    "two@@example.com",
    "a@b", // no dot in the domain
    "a@b.",
    "a@.com",
    "a b@example.com",
    "a@exa mple.com",
    "a,b@example.com", // would be read as two recipients
    "a@example.com,b@example.org",
    "a@example.com;b@example.org",
    "<a@example.com>",
    '"a"@example.com',
    "a@example.com\r\nBcc: x@y.com",
    "a@-example.com",
  ])("rejects %j", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it("rejects non-strings and over-long addresses", () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@b.co`)).toBe(false);
  });
});

describe("isValidMenuItemId", () => {
  it.each(["bb-choc-chip-cookies", "5kKMWsanez83t6gM5h1B", "a", "item_1", "A".repeat(64)])("accepts %s", (id) => {
    expect(isValidMenuItemId(id)).toBe(true);
  });

  it.each(["", ".", "..", "a/b", "../config/global", "a b", "a.b", "A".repeat(65), 42, null, undefined])(
    "rejects %j",
    (id) => {
      expect(isValidMenuItemId(id)).toBe(false);
    },
  );
});

describe("singleLine", () => {
  it("collapses line breaks and tabs to one space and trims", () => {
    expect(singleLine("Ann\r\nBcc: evil@x.com")).toBe("Ann Bcc: evil@x.com");
    expect(singleLine("  Ann\t\tLee \n")).toBe("Ann Lee");
    expect(singleLine("Plain Name")).toBe("Plain Name");
  });
});

describe("isAlreadyExists", () => {
  it("recognises Firestore's already-exists error in its different forms", () => {
    expect(isAlreadyExists({ code: 6 })).toBe(true);
    expect(isAlreadyExists({ code: "already-exists" })).toBe(true);
    expect(isAlreadyExists({ code: "ALREADY_EXISTS" })).toBe(true);
  });

  it("does not match other errors", () => {
    expect(isAlreadyExists({ code: 14 })).toBe(false);
    expect(isAlreadyExists({ code: "unavailable" })).toBe(false);
    expect(isAlreadyExists(new Error("boom"))).toBe(false);
    expect(isAlreadyExists(null)).toBe(false);
    expect(isAlreadyExists(undefined)).toBe(false);
  });
});
