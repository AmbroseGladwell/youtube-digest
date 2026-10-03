import type { AuthIntent } from "@overview/domain";

export type LibraryPlace = "browser" | "phone" | "extension";

const WHERE: Record<LibraryPlace, string> = {
  browser: "saved in this browser",
  phone: "saved on this phone",
  extension: "saved in the extension",
};

// What joining an account does to the library already here: signing in moves it into the
// account, one overview per video, and the account's copy is kept where both have one
// (docs/features/account-libraries.md, design 47h). A new account holds nothing to clash
// with, so creating one says nothing about it. Nothing to say about an empty library.
export function savedOverviewsNote(count: number, intent: AuthIntent, place: LibraryPlace): string | null {
  if (count <= 0) {
    return null;
  }
  if (intent === "createAccount") {
    const overviews = count === 1 ? `overview ${WHERE[place]}` : `${count} overviews ${WHERE[place]}`;
    const everywhere = place === "browser" ? ", so they're there on your phone, in the extension and on any other device" : "";
    return `The ${overviews} ${count === 1 ? "comes" : "come"} with you${everywhere}.`;
  }
  const overviews = count === 1 ? `Overview ${WHERE[place]}` : `${count} Overviews ${WHERE[place]}`;
  const except = count === 1 ? "unless it already has one for that video" : "except any for videos it already has";
  const everywhere =
    place === "browser"
      ? ` You’ll then have ${count === 1 ? "it" : "them"} on your phone, in the extension and on any other device.`
      : "";
  return `Signing in adds the ${overviews} to your account, ${except}.${everywhere}`;
}
