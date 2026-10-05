import { useId, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { isYouTubeUrl } from "../../../newOverview/util/parseYouTubeUrl.js";
import { rememberSharedPageIntent } from "../../util/sharedPageIntent.js";
import styles from "./MakeYourOwnAside.module.scss";
import { makeYourOwnAsideTestIds } from "./MakeYourOwnAsideTestIds.js";

const PLUS = [
  "Audio overviews, like this one",
  "Ask your AI assistant about your library, through an MCP connection",
  "Your library synced across your devices",
];

// Design 30e: the page is also the way in. The pasted link is carried through creating an
// account rather than lost on the way (docs/features/sharing.md).
export function MakeYourOwnAside() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const headingId = useId();
  const urlFieldId = useId();
  const analytics = useAnalytics();
  useTypingSettled(url, () => analytics.sharedPage.makeYourOwn.linkEntered({ recognised: isYouTubeUrl(url.trim()) }));

  const make = () => {
    analytics.sharedPage.makeYourOwn.submitted({ recognised: isYouTubeUrl(url.trim()) });
    rememberSharedPageIntent({ kind: "generate", videoUrl: url.trim() });
    void navigate(Routes.createAccount());
  };

  return (
    <aside className={styles.root} aria-labelledby={headingId} data-testid={makeYourOwnAsideTestIds.root}>
      <span className={styles.mark}>
        <OverviewMark size={26} />
      </span>
      <h2 className={styles.heading} id={headingId}>
        Watch Less, with The Overview
      </h2>
      <p className={styles.body}>
        Paste any YouTube link. You get a short read and a listen like this one, with a verdict on
        whether the video is worth your time.
      </p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          make();
        }}
      >
        <div className={styles.field}>
          <input
            id={urlFieldId}
            name="video-url"
            type="url"
            autoComplete="off"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            onChange={(event) => setUrl(event.target.value)}
            data-testid={makeYourOwnAsideTestIds.urlField}
          />
        </div>
        <button
          type="submit"
          className={styles.action}
          disabled={url.trim() === ""}
          data-testid={makeYourOwnAsideTestIds.makeButton}
        >
          Make an overview
        </button>
      </form>

      <p className={styles.note}>
        Free to start. Have an account?{" "}
        <Link
          className={styles.link}
          to={Routes.signIn()}
          onClick={() => analytics.sharedPage.makeYourOwn.signInChosen()}
          data-testid={makeYourOwnAsideTestIds.signInLink}
        >
          Sign in
        </Link>
      </p>

      <div className={styles.plus} data-testid={makeYourOwnAsideTestIds.plusList}>
        <span className={styles.plusChip}>Plus</span>
        <ul className={styles.plusList}>
          {PLUS.map((line) => (
            <li key={line}>
              <span className={styles.tick}>
                <StrokeIcon name="check" size={14} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
