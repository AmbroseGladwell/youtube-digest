import { useSurface } from "../../../../app/SurfaceContext.js";
import { policyPageUrl } from "../../../analyticsConsent/util/policyPageUrl.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
import styles from "./AccountTermsLine.module.scss";
import { accountTermsLineTestIds } from "./AccountTermsLineTestIds.js";

// Design 62j: read before Create account, so creating an account is agreeing to the terms
// and to sharing which features are used. No checkbox: that sharing rests on legitimate
// interests, not consent, and Settings › Privacy still turns it off
// (docs/features/analytics-consent.md, "Creating an account").
export function AccountTermsLine() {
  const apiUrl = useKnownApiUrl();
  const opensElsewhere = useSurface() === "extension";
  if (apiUrl === null) return null;
  const target = opensElsewhere ? { target: "_blank", rel: "noreferrer" } : {};

  return (
    <p className={styles.root} data-testid={accountTermsLineTestIds.root}>
      By creating an account, you agree to the{" "}
      <a className={styles.link} href={policyPageUrl(apiUrl, "terms")} {...target} data-testid={accountTermsLineTestIds.terms}>
        Terms
      </a>{" "}
      and{" "}
      <a className={styles.link} href={policyPageUrl(apiUrl, "privacy")} {...target} data-testid={accountTermsLineTestIds.privacy}>
        Privacy policy
      </a>
      , including sharing which features you use. You can turn this off in Settings › Privacy.
    </p>
  );
}
