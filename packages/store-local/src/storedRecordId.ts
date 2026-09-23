export function storedRecordId(raw: unknown, keyPath: string): string {
  if (typeof raw !== "object" || raw === null) {
    return "";
  }
  const id = (raw as Record<string, unknown>)[keyPath];
  return typeof id === "string" ? id : "";
}
