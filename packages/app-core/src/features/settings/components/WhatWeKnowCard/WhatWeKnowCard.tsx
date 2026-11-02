import { useState } from "react";
import { aboutYouIsEmpty, aboutYouPatch, aboutYouSentenceParts, EMPTY_ABOUT_YOU } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTopicsQuery } from "../../../overviews/queries/topicsQuery.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { AboutYouEditor } from "../AboutYouEditor/AboutYouEditor.js";
import styles from "./WhatWeKnowCard.module.scss";
import { whatWeKnowCardTestIds } from "./WhatWeKnowCardTestIds.js";

// Designs 141k and 141l: the sentence as it reads, then in place with its sections editable. It
// is what every overview from now on is written for, so the card says where it goes on us
// (docs/features/personalisation.md).
export function WhatWeKnowCard() {
  const aboutYou = useSettingsQuery().data?.aboutYou ?? EMPTY_ABOUT_YOU;
  const topicNames = (useTopicsQuery().data ?? []).map(({ name }) => name);
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  const empty = aboutYouIsEmpty(aboutYou);

  const save = (next: typeof aboutYou) => {
    analytics.settings.personalisation.aboutYouSaved({ set: !aboutYouIsEmpty(next) });
    updateSettings.mutate(aboutYouPatch(next));
  };

  if (open) {
    return (
      <div className={styles.card} data-testid={whatWeKnowCardTestIds.root}>
        <div className={styles.open}>
          <span className={styles.title}>What we know about you</span>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Your sentence</span>
            <AboutYouEditor
              aboutYou={aboutYou}
              size="card"
              topicNames={topicNames}
              onChange={(section, entries) => save({ ...aboutYou, [section]: entries })}
            />
          </div>
          <p className={styles.costNote}>When overviews are made on us, this goes through our server to OpenAI with each one.</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                save(EMPTY_ABOUT_YOU);
                setOpen(false);
              }}
              data-testid={whatWeKnowCardTestIds.clear}
            >
              Clear everything
            </button>
            <button type="button" className={styles.done} onClick={() => setOpen(false)} data-testid={whatWeKnowCardTestIds.done}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={styles.card} data-testid={whatWeKnowCardTestIds.root}>
        <div className={styles.closedEmpty}>
          <span className={styles.text}>
            <span className={styles.title}>What we know about you</span>
            <span className={styles.unset} data-testid={whatWeKnowCardTestIds.empty}>
              Add a little about you and the steps at the end of each overview fit around you.
            </span>
          </span>
          <button
            type="button"
            className={styles.openButton}
            aria-label="Set up what we know about you"
            onClick={() => setOpen(true)}
            data-testid={whatWeKnowCardTestIds.open}
          >
            <StrokeIcon name="plus" size={14} />
            Set up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card} data-testid={whatWeKnowCardTestIds.root}>
      <div className={styles.closed}>
        <div className={styles.closedTop}>
          <span className={styles.title}>What we know about you</span>
          <button
            type="button"
            className={styles.openButton}
            aria-label="Edit what we know about you"
            onClick={() => setOpen(true)}
            data-testid={whatWeKnowCardTestIds.open}
          >
            <StrokeIcon name="pencil" size={14} />
            Edit
          </button>
        </div>
        <p className={styles.sentence} data-testid={whatWeKnowCardTestIds.sentence}>
          {aboutYouSentenceParts(aboutYou).map(({ text, filled }, index) =>
            filled ? (
              <span key={index} className={styles.filled}>
                {text}
              </span>
            ) : (
              text
            ),
          )}
        </p>
      </div>
    </div>
  );
}
