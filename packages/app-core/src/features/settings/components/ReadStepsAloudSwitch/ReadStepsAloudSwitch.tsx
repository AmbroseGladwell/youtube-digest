import { useId } from "react";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./ReadStepsAloudSwitch.module.scss";
import { readStepsAloudSwitchTestIds } from "./ReadStepsAloudSwitchTestIds.js";

// Designs 289i–289l: above Timer sound, the same setting as cooking mode's Mute, read the
// other way round. It saves at once and syncs.
export function ReadStepsAloudSwitch() {
  const analytics = useAnalytics();
  const settings = useSettingsQuery().data;
  const updateSettings = useUpdateSettingsMutation();
  const on = settings?.readStepsAloud ?? true;
  const labelId = useId();
  const hintId = useId();

  return (
    <div className={styles.root} data-testid={readStepsAloudSwitchTestIds.root}>
      <span className={styles.text}>
        <span className={styles.label} id={labelId}>
          Read steps aloud
        </span>
        <span className={styles.hint} id={hintId}>
          Each action is read, then the voice waits for you. Off, the steps are text only. Timers ring either way.
        </span>
      </span>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        onClick={() => {
          analytics.settings.cooking.readStepsAloudChosen({ on: !on });
          updateSettings.mutate({ readStepsAloud: !on });
        }}
        data-testid={readStepsAloudSwitchTestIds.switch}
      >
        <span className={styles.knob} />
      </button>
    </div>
  );
}
