// Small pure input checks used by processPayment (no Firebase imports, unit tested
// in validation.spec.ts).

// Same shape as the HTML spec's email pattern: one address, no spaces, no commas,
// semicolons, angle brackets or quotes (so it cannot be read as several recipients
// by the mail library), and a dot in the domain.
const EMAIL_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export const MAX_EMAIL_LENGTH = 254;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(value);
}

// Menu item ids are Firestore document ids: auto ids (letters and digits) or the
// hand-written slugs (lowercase with hyphens). Refuse anything else, including "."
// and "..", before it is used in a document path.
const MENU_ITEM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidMenuItemId(value: unknown): value is string {
  return typeof value === "string" && MENU_ITEM_ID_RE.test(value);
}

/** Collapse line breaks and tabs to single spaces (used for text that ends up in an email subject). */
export function singleLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

/** True for Firestore's "document already exists" error (gRPC code 6). */
export function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}
