// The list's subtitle. Once this device has signed out of an account it says where these
// are kept, shortened on a phone as design 47a does (docs/features/account-libraries.md).
export function libraryCountLine(
  { total, unread }: { total: number; unread: number },
  { savedHere, phone }: { savedHere: string | null; phone: boolean },
): string {
  const noun = total === 1 ? "overview" : "overviews";
  const held = savedHere === null ? `${total} ${noun}` : phone ? `${total} ${savedHere}` : `${total} ${noun} ${savedHere}`;
  return `${held} · ${unread} unread`;
}
