/**
 * Strict Undefined-Stripping & Payload Hygiene Utility
 * Strips all undefined values recursively from objects and arrays
 * to prevent Firestore driver exceptions.
 */
export function sanitizePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as unknown as T;
  }

  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof input === 'object' && !(input instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }

  return input;
}
