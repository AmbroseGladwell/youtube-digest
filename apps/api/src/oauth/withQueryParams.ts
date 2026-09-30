export function withQueryParams(uri: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(uri);
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(name, value);
    }
  }
  return url.toString();
}
