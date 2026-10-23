import { useId } from "react";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./OnlyMyKeySwitch.module.scss";
import { onlyMyKeySwitchTestIds } from "./OnlyMyKeySwitchTestIds.js";

export const FALLBACK_ON =
  "When your key can’t make an overview, because it’s out of credit or its provider is down, we make it on ours and say so on the overview. That sends the transcript and your reader context to OpenAI through our server.";
export const FALLBACK_OFF =
  "When your key can’t make an overview, it fails, and nothing is sent to OpenAI. Turn this off to have ours make it instead.";

// Beside the keys, because it is about where they send things (docs/architecture/tiers.md,
// "Which key an overview uses"). Off by default: the fallback is on until the reader says.
export function OnlyMyKeySwitch() {
  const onlyMyKey = useSettingsQuery().data?.onlyMyKey ?? false;
  const updateSettings = useUpdateSettingsMutation();
  const labelId = useId();
  const explanationId = useId();

  return (
    <div className={styles.card} data-testid={onlyMyKeySwitchTestIds.root}>
      <div className={styles.switchRow}>
        <span className={styles.switchLabel} id={labelId}>
          Only ever use my key
        </span>
        <button
          type="button"
          role="switch"
          className={styles.switch}
          aria-checked={onlyMyKey}
          aria-labelledby={labelId}
          aria-describedby={explanationId}
          onClick={() => updateSettings.mutate({ onlyMyKey: !onlyMyKey })}
          data-testid={onlyMyKeySwitchTestIds.switch}
        >
          <span className={styles.knob} />
        </button>
      </div>
      <p className={styles.body} id={explanationId} data-testid={onlyMyKeySwitchTestIds.explanation}>
        {onlyMyKey ? FALLBACK_OFF : FALLBACK_ON}
      </p>
    </div>
  );
}
