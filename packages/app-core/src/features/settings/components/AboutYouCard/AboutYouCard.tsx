import { useId, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import {
  ABOUT_YOU_GOALS,
  ABOUT_YOU_ROLES,
  aboutYouLine,
  MAX_ABOUT_YOU_LENGTH,
  toggledGoals,
  type AboutYouGoal,
  type AboutYouRole,
} from "../../util/aboutYou.js";
import styles from "./AboutYouCard.module.scss";
import { aboutYouCardTestIds } from "./AboutYouCardTestIds.js";

// Design 46s: About you above the section switches, edited in place with the same chips and
// line as onboarding asked with. It is the reader context every overview from now on is written
// for, so the card says where it goes on us (docs/features/personalisation.md).
export function AboutYouCard() {
  const readerContext = useSettingsQuery().data?.readerContext ?? null;
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<AboutYouRole | null>(null);
  const [goals, setGoals] = useState<AboutYouGoal[]>([]);
  const [line, setLine] = useState("");
  const roleLabel = useId();
  const goalLabel = useId();
  const lineId = useId();

  const save = (next: string | null) => {
    analytics.settings.personalisation.aboutYouSaved({ set: next !== null });
    updateSettings.mutate({ readerContext: next });
    setEditing(false);
  };
  const rebuild = (nextRole: AboutYouRole | null, nextGoals: AboutYouGoal[]) => {
    setRole(nextRole);
    setGoals(nextGoals);
    setLine(aboutYouLine(nextRole, nextGoals));
  };

  if (!editing) {
    return (
      <div className={styles.card} data-testid={aboutYouCardTestIds.root}>
        <div className={styles.closed}>
          <span className={styles.text}>
            <span className={styles.title}>About you</span>
            <span className={readerContext === null ? styles.unset : styles.value} data-testid={aboutYouCardTestIds.value}>
              {readerContext ?? "Not set, so overviews are written for anyone."}
            </span>
          </span>
          <button
            type="button"
            className={styles.open}
            aria-label="Edit About you"
            onClick={() => {
              setRole(null);
              setGoals([]);
              setLine(readerContext ?? "");
              setEditing(true);
            }}
            data-testid={aboutYouCardTestIds.open}
          >
            <StrokeIcon name={readerContext === null ? "plus" : "pencil"} size={14} />
            {readerContext === null ? "Set up" : "Edit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card} data-testid={aboutYouCardTestIds.root}>
      <div className={styles.open_}>
        <span className={styles.title}>About you</span>
        <div className={styles.group} role="group" aria-labelledby={roleLabel}>
          <span id={roleLabel} className={styles.groupLabel}>
            What you do
          </span>
          <div className={styles.chips}>
            {ABOUT_YOU_ROLES.map(({ label }) => (
              <button
                key={label}
                type="button"
                className={styles.chip}
                aria-pressed={role === label}
                onClick={() => rebuild(role === label ? null : label, goals)}
                data-testid={aboutYouCardTestIds.role(label)}
              >
                {role === label && <StrokeIcon name="check" size={14} />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.group} role="group" aria-labelledby={goalLabel}>
          <span id={goalLabel} className={styles.groupLabel}>
            What you want to get better at · up to two
          </span>
          <div className={styles.chips}>
            {ABOUT_YOU_GOALS.map((goal) => (
              <button
                key={goal}
                type="button"
                className={styles.chip}
                aria-pressed={goals.includes(goal)}
                onClick={() => rebuild(role, toggledGoals(goals, goal))}
                data-testid={aboutYouCardTestIds.goal(goal)}
              >
                {goals.includes(goal) && <StrokeIcon name="check" size={14} />}
                {goal}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <label htmlFor={lineId} className={styles.groupLabel}>
            We'll write for
          </label>
          <input
            id={lineId}
            className={styles.line}
            placeholder="For example: A nurse learning to cook"
            value={line}
            maxLength={MAX_ABOUT_YOU_LENGTH}
            onChange={(event) => setLine(event.target.value)}
            data-testid={aboutYouCardTestIds.line}
          />
        </div>
        <p className={styles.costNote}>When overviews are made on us, this goes through our server to OpenAI with each one.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={() => save(null)} data-testid={aboutYouCardTestIds.clear}>
            Clear
          </button>
          <button
            type="button"
            className={styles.done}
            onClick={() => save(line.trim() === "" ? null : line.trim())}
            data-testid={aboutYouCardTestIds.done}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
