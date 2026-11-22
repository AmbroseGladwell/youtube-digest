import { useSurface } from "../../../../app/SurfaceContext.js";
import { policyPageUrl } from "../../../analyticsConsent/util/policyPageUrl.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import styles from "./PolicyLinks.module.scss";
import { policyLinksTestIds } from "./PolicyLinksTestIds.js";

export const PolicyLinks = () => {
  const apiUrl = useKnownApiUrl();
  const opensElsewhere = useSurface() === "extension";
  if (apiUrl === null) {
    return null;
  }
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
};
