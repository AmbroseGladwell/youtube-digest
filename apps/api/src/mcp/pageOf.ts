export interface Page<T> {
  items: T[];
  first: number;
  total: number;
  next: string | null;
}

// The cursor is an offset into the list as it stands now: a library that changes between
// calls can shift a page by one, which an assistant reading it can live with.
export function pageOf<T>(items: T[], cursor: string | undefined, size: number): Page<T> {
  const first = cursor === undefined ? 0 : Math.min(Number(cursor), items.length);
  const end = first + size;
  return {
    items: items.slice(first, end),
    first,
    total: items.length,
    next: end < items.length ? String(end) : null,
  };
}
