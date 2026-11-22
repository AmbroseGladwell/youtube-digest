import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { CHROME_EXTENSION_URL } from "../../../../util/chromeExtensionUrl.js";
import { useExtensionOffered } from "../../../../util/useExtensionOffered.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingSavingMoment.module.scss";
import { onboardingSavingMomentTestIds } from "./OnboardingSavingMomentTestIds.js";
import { onboardingPageTestIds } from "../../OnboardingPage/OnboardingPageTestIds.js";

const HEADING = "Save the content you want to come back to.";
const LIBRARY = "Your library";
const LIBRARY_NOTE = "4 kinds, one place";
const KINDS: readonly { icon: StrokeIconName; name: string; from: string; becomes: string }[] = [
  { icon: "play", name: "Videos", from: "YouTube", becomes: "The good bits, and the part worth watching." },
  { icon: "fileText", name: "Articles", from: "Any web page", becomes: "The point in 2 minutes." },
  { icon: "mic", name: "Podcasts", from: "Apple Podcasts, Spotify", becomes: "The ideas from any episode." },
  { icon: "chefHat", name: "Recipes", from: "Any recipe site", becomes: "Made easy to follow with cooking mode." },
];
const EXTENSION_TITLE = "Add content in 1 click with the extension";
const EXTENSION_NAME = "The Overview for Chrome";
const EXTENSION_ACTION = "Add to Chrome";
const CONTINUE = "Continue";

export interface OnboardingSavingMomentProps {
  onContinue: () => void;
  onSkip: () => void;
}

export const OnboardingSavingMoment = ({ onContinue, onSkip }: OnboardingSavingMomentProps) => {
  const extensionOffered = useExtensionOffered();
  return (
    <div className={styles.root} data-testid={onboardingSavingMomentTestIds.root}>
      <OnboardingHeading>{HEADING}</OnboardingHeading>

      <section className={styles.library} aria-label={`${LIBRARY}: ${LIBRARY_NOTE}`}>
        <div className={styles.libraryHead}>
          <span className={styles.libraryName}>
            <span className={styles.mark}>
              <OverviewMark size={18} />
            </span>
            {LIBRARY}
          </span>
          <span className={styles.libraryNote}>{LIBRARY_NOTE}</span>
        </div>
        <ul className={styles.kinds}>
          {KINDS.map((kind) => (
            <li key={kind.name} className={styles.kind}>
              <span className={styles.tile}>
                <StrokeIcon name={kind.icon} size={17} />
              </span>
              <span className={styles.kindName}>
                <span className={styles.name}>{kind.name}</span>
                <span className={styles.from}>{kind.from}</span>
              </span>
              <span className={styles.becomes}>{kind.becomes}</span>
            </li>
          ))}
        </ul>
      </section>

      {extensionOffered && (
        <div className={styles.extension}>
          <span className={styles.extensionText}>
            <span className={styles.extensionTitle}>{EXTENSION_TITLE}</span>
            <span className={styles.extensionName}>{EXTENSION_NAME}</span>
          </span>
          <a
            className={styles.extensionAction}
            href={CHROME_EXTENSION_URL}
            target="_blank"
            rel="noopener"
            aria-label={`${EXTENSION_ACTION}, opens in a new tab`}
            data-testid={onboardingSavingMomentTestIds.addToChrome}
          >
            {EXTENSION_ACTION}
          </a>
        </div>
      )}

      <div className={styles.foot}>
        <button type="button" className={styles.primary} onClick={onContinue} data-testid={onboardingSavingMomentTestIds.next}>
          {CONTINUE}
        </button>
        <button type="button" className={styles.quiet} onClick={onSkip} data-testid={onboardingPageTestIds.skip}>
          Skip
        </button>
      </div>
    </div>
  );
};
