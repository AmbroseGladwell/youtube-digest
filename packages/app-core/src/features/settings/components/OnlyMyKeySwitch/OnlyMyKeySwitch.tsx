import { useId } from "react";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./OnlyMyKeySwitch.module.scss";
import { onlyMyKeySwitchTestIds } from "./OnlyMyKeySwitchTestIds.js";

export const FALLBACK_ON =
  "When your key can’t make an overview, because it’s out of credit or its provider is down, we make it on us and say so on the overview. That sends the transcript and your reader context to OpenAI through our server.";
export const FALLBACK_OFF =
  "When your key can’t make an overview, it fails, and nothing is sent to OpenAI. Turn this off to have us make it instead.";
// Said so a reader keeping transcripts from us isn't surprised that chat runs on us (docs/features/chats.md).
export const OWN_KEY_FOR_OVERVIEWS_ONLY =
  "Your key is only used to make overviews. Questions you ask about an overview are always answered on us, within your plan’s allowance, whether or not this is on.";

// Which key an overview uses: docs/architecture/tiers.md, "Which key an overview uses".
export const OnlyMyKeySwitch = () => {
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
      <p className={styles.body} data-testid={onlyMyKeySwitchTestIds.overviewsOnly}>
        {OWN_KEY_FOR_OVERVIEWS_ONLY}
      </p>
    </div>
  );
};
