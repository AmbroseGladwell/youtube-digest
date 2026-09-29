import type { AuthIntent } from "@overview/domain";

export type LibraryPlace = "browser" | "phone" | "extension";

const WHERE: Record<LibraryPlace, string> = {
  browser: "saved in this browser",
  phone: "saved on this phone",
  extension: "saved in the extension",
};

// What joining an account does to the library already here: the first sync pushes all of
// it (docs/features/sync-client.md, "Enrolment"). Nothing to say about an empty one.
export function savedOverviewsNote(count: number, intent: AuthIntent, place: LibraryPlace): string | null {
  if (count <= 0) {
    return null;
  }
  const overviews = count === 1 ? `overview ${WHERE[place]}` : `${count} overviews ${WHERE[place]}`;
  const everywhere = place === "browser" ? ", so they're there on your phone, in the extension and on any other device" : "";
  return intent === "createAccount"
    ? `The ${overviews} ${count === 1 ? "comes" : "come"} with you${everywhere}.`
    : `Signing in adds the ${overviews} to your account${everywhere}.`;
}
