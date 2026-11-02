import type { SourceKey } from "./Brands.js";

export interface SourceReference {
  kind: string;
  id: string | null;
}

// The one string every store keys an item by. V0024's source_key column spells the same rule
// in SQL, and a test holds the two together (docs/features/source-identity.md).
export function sourceKey({ kind, id }: SourceReference): SourceKey | null {
  if (id === null) return null;
  return (kind === "youtube" ? id : `${kind}:${id}`) as SourceKey;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

// Read loosely rather than parsed: the body may be at any version, before or after `video`
// became `source`.
export function storedSourceKey(body: unknown): SourceKey | null {
  if (!isObject(body)) return null;
  const { source, video } = body;
  if (isObject(source) && typeof source.kind === "string" && typeof source.id === "string") {
    return sourceKey({ kind: source.kind, id: source.id });
  }
  return isObject(video) && typeof video.id === "string" ? sourceKey({ kind: "youtube", id: video.id }) : null;
}
