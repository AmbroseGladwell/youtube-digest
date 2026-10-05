import { useSurface } from "../../../../app/SurfaceContext.js";
import { policyPageUrl } from "../../../analyticsConsent/util/policyPageUrl.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import styles from "./PolicyLinks.module.scss";
import { policyLinksTestIds } from "./PolicyLinksTestIds.js";

// Designs 62d and 62i: the privacy policy and the terms, as plain links, at the foot of
// Settings › Privacy and under the version in About. From the extension they open the web
// app's pages in a tab of their own.
export function PolicyLinks() {
  const apiUrl = useKnownApiUrl();
  const opensElsewhere = useSurface() === "extension";
  if (apiUrl === null) return null;
  const target = opensElsewhere ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <p className={styles.root} data-testid={policyLinksTestIds.root}>
      <a className={styles.link} href={policyPageUrl(apiUrl, "privacy")} {...target} data-testid={policyLinksTestIds.privacy}>
        Privacy policy
      </a>
      <a className={styles.link} href={policyPageUrl(apiUrl, "terms")} {...target} data-testid={policyLinksTestIds.terms}>
        Terms
      </a>
    </p>
  );
}
