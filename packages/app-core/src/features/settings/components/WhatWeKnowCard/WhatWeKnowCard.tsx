import { useId, useState } from "react";
import {
  aboutYouIsEmpty,
  aboutYouPatch,
  aboutYouSentenceParts,
  EMPTY_ABOUT_YOU,
  keptLearnedItems,
  learnedItemKey,
  type AboutYou,
  type LearnedItem,
  type LearnedItems,
} from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTopicsQuery } from "../../../overviews/queries/topicsQuery.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import { useCanLearn } from "../../useCanLearn.js";
import { AboutYouEditor } from "../AboutYouEditor/AboutYouEditor.js";
import styles from "./WhatWeKnowCard.module.scss";
import { whatWeKnowCardTestIds } from "./WhatWeKnowCardTestIds.js";

const learningLine = (count: number, keepLearning: boolean) => {
  if (!keepLearning) return count === 0 ? "Keep learning is off" : `${things(count)} learned · Keep learning is off`;
  return count === 0 ? "Nothing learned yet · Keep learning is on" : `${things(count)} learned from your overviews · Keep learning is on`;
};
const things = (count: number) => (count === 1 ? "1 thing" : `${count} things`);

// Designs 141k and 141l: the sentence as it reads, then in place with its sections editable,
// what was learned and Keep learning. It is what every overview from now on is written for, so
// the card says where it goes on us. Where no key can run the pass, learning isn't offered, but
// items already held stay readable and removable, since they're still sent
// (docs/features/personalisation.md).
export function WhatWeKnowCard() {
  const settings = useSettingsQuery().data;
  const aboutYou = settings?.aboutYou ?? EMPTY_ABOUT_YOU;
  const learned = keptLearnedItems(settings?.learned ?? {});
  const keepLearning = settings?.keepLearning ?? true;
  const canLearn = useCanLearn();
  const topicNames = (useTopicsQuery().data ?? []).map(({ name }) => name);
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  const switchLabel = useId();
  const switchHint = useId();
  const empty = aboutYouIsEmpty(aboutYou) && learned.length === 0;

  const removed = (items: readonly LearnedItem[]): LearnedItems => {
    const at = new Date().toISOString();
    return Object.fromEntries(items.map((item) => [learnedItemKey(item.text), { ...item, noticedAt: item.noticedAt ?? at, removedAt: at }]));
  };

  const save = (next: AboutYou) => {
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
          {(canLearn || learned.length > 0) && (
            <>
              <div className={styles.learned}>
                <span className={styles.title}>Learned from your overviews</span>
                <p className={styles.help}>Picked up from what you save. Remove anything that's wrong and it won't come back.</p>
                {learned.length > 0 ? (
                  <ul className={styles.learnedList} aria-label="Learned from your overviews">
                    {learned.map((item) => (
                      <li key={item.text} className={styles.learnedItem} data-testid={whatWeKnowCardTestIds.learnedItem(item.text)}>
                        <span className={styles.text}>
                          <span className={styles.title}>{item.text}</span>
                          <span className={styles.source}>{item.source}</span>
                        </span>
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`Remove ${item.text}`}
                          onClick={() => {
                            analytics.settings.personalisation.learnedItemRemoved();
                            updateSettings.mutate({ learned: removed([item]) });
                          }}
                          data-testid={whatWeKnowCardTestIds.learnedRemove(item.text)}
                        >
                          <StrokeIcon name="close" size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.help} data-testid={whatWeKnowCardTestIds.learnedEmpty}>
                    Nothing yet. After a few overviews, what we pick up shows here, and we'll tell you each time.
                  </p>
                )}
              </div>
              {canLearn && (
              <div className={styles.keepLearning}>
                <span className={styles.text}>
                  <span id={switchLabel} className={styles.title}>
                    Keep learning
                  </span>
                  <span id={switchHint} className={styles.help}>
                    {keepLearning ? "Every few overviews we add what we've noticed, and tell you." : "Off. What's here stays until you remove it."}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  className={styles.switch}
                  aria-checked={keepLearning}
                  aria-labelledby={switchLabel}
                  aria-describedby={switchHint}
                  onClick={() => {
                    analytics.settings.personalisation.learningSwitched({ on: !keepLearning });
                    updateSettings.mutate({ keepLearning: !keepLearning });
                  }}
                  data-testid={whatWeKnowCardTestIds.keepLearning}
                >
                  <span className={styles.knob} />
                </button>
              </div>
              )}
            </>
          )}
          <p className={styles.costNote}>When overviews are made on us, this goes through our server to OpenAI with each one.</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                analytics.settings.personalisation.aboutYouSaved({ set: false });
                updateSettings.mutate({ ...aboutYouPatch(EMPTY_ABOUT_YOU), learned: removed(learned) });
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
        {canLearn && (
          <p className={styles.meta} data-testid={whatWeKnowCardTestIds.meta}>
            {learningLine(learned.length, keepLearning)}
          </p>
        )}
      </div>
    </div>
  );
}
