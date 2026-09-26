const ORIGIN = /^[a-z][a-z0-9+.-]*:\/\/[^/?#\s]+$/i;

export class AllowedOriginError extends Error {}

export function allowedOriginsFromEnv(value: string | undefined): string[] {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  for (const origin of origins) {
    if (!ORIGIN.test(origin)) {
      throw new AllowedOriginError(
        `"${origin}" is not an origin: expected scheme://host[:port] with no path, and never *`,
      );
    }
  }
  return origins;
}
