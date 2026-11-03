import { describe, expect, it } from "vitest";
import { pastedLinkFailureCopy, CHROME_EXTENSION_URL } from "./pastedLinkFailureCopy.js";

const URL_OF_PAGE = "https://www.harbourpost.example/bridge";

describe("pastedLinkFailureCopy", () => {
  it("sends a blocked reader who has the extension to the article", () => {
    const copy = pastedLinkFailureCopy({ status: "failed", reason: "blocked" }, URL_OF_PAGE, "extension");
    expect(copy.href).toBe(URL_OF_PAGE);
    expect(copy.after).toBe("Then press Create overview in the side panel.");
    expect(copy.sentToExtension).toBe(true);
  });

  it("sends one without it to the store, and says where the link goes", () => {
    const copy = pastedLinkFailureCopy({ status: "failed", reason: "paywalled" }, URL_OF_PAGE, "computer");
    expect(copy.href).toBe(CHROME_EXTENSION_URL);
    expect(copy.wayLabel).toBe("Get the extension on the Chrome Web Store");
  });

  it("offers a phone another link, since there is no extension there", () => {
    const copy = pastedLinkFailureCopy({ status: "failed", reason: "blocked" }, URL_OF_PAGE, "phone");
    expect(copy.href).toBeNull();
    expect(copy.wayLabel).toBe("Try another link");
    expect(copy.sentToExtension).toBe(false);
  });

  it("doesn't send anyone to the extension for a link that isn't an article", () => {
    expect(pastedLinkFailureCopy({ status: "failed", reason: "nothing-readable" }, URL_OF_PAGE, "computer").sentToExtension).toBe(false);
  });
});
