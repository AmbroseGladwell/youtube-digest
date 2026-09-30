export type ByteRange = { start: number; end: number } | "unsatisfiable" | null;

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

// One range, inclusive, as Safari asks for media: `bytes=0-1`, `bytes=500-`, `bytes=-500`.
// null means serve the whole file; several ranges are answered whole, which RFC 9110 allows.
export function byteRange(header: string | undefined, size: number): ByteRange {
  if (header === undefined) {
    return null;
  }
  const match = SINGLE_RANGE.exec(header.trim());
  if (match === null) {
    return null;
  }
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") {
    return null;
  }
  if (first === "") {
    const suffix = Number(last);
    return suffix === 0 ? "unsatisfiable" : { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(first);
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  if (start >= size || start > end) {
    return "unsatisfiable";
  }
  return { start, end };
}
