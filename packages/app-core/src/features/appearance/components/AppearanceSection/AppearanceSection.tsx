import { useId, useState } from "react";
import {
  ACCENT_COLOUR_NAMES,
  ACCENT_COLOURS,
  ACCENT_PALETTES,
  THEME_MODE_NAMES,
  THEME_MODES,
  type AccentColour,
  type ThemeMode,
} from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../../../settings/mutations/useUpdateSettingsMutation.js";
import { useSync } from "../../../sync/SyncContext.js";
import { applyAppearance } from "../../applyAppearance.js";
import { writeAppearance, type Appearance } from "../../appearanceStorage.js";
import { useAppearance } from "../../useAppearance.js";
import styles from "./AppearanceSection.module.scss";
import { appearanceSectionTestIds } from "./AppearanceSectionTestIds.js";

export const APPEARANCE_STANDFIRST = "Changes apply straight away, here and on every device you sign in on.";

const THEME_ICONS: Record<ThemeMode, StrokeIconName> = { system: "monitor", light: "sun", dark: "moon" };

const themeLine = (theme: ThemeMode, deviceIsDark: boolean): string =>
  theme === "system"
    ? `Follows your device, which is ${deviceIsDark ? "dark" : "light"} right now.`
    : `Always ${theme}, whatever your device uses.`;

// Native radios under the paint, so arrow keys move the choice and it applies as they move
// (design 135d).
export function AppearanceSection() {
  const saved = useAppearance();
  const updateSettings = useUpdateSettingsMutation();
  const appearance = updateSettings.isPending ? { ...saved, ...updateSettings.variables } : saved;
  const analytics = useAnalytics();
  const { connected } = useSync();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const deviceIsDark = useMediaQuery("(prefers-color-scheme: dark)");
  const groupName = useId();
  const themeLabelId = useId();
  const accentLabelId = useId();
  const [status, setStatus] = useState("");

  const dark = appearance.theme === "dark" || (appearance.theme === "system" && deviceIsDark);
  const savedTo = connected ? "Saved to your account." : "Saved on this device.";

  const choose = (patch: Partial<Appearance>, said: string) => {
    const next = { ...appearance, ...patch };
    applyAppearance(next);
    writeAppearance(next);
    setStatus(`${said} ${savedTo}`);
    updateSettings.mutate(patch);
  };

  const chooseTheme = (theme: ThemeMode) => {
    analytics.settings.appearance.themeChosen({ theme });
    choose({ theme }, `Theme: ${THEME_MODE_NAMES[theme]}.`);
  };

  const chooseAccent = (accentColour: AccentColour) => {
    analytics.settings.appearance.accentChosen({ accentColour });
    choose({ accentColour }, `Accent colour: ${ACCENT_COLOUR_NAMES[accentColour]}.`);
  };

  return (
    <div
      className={styles.root}
      data-size={isPanel ? "panel" : isPhone ? "phone" : "wide"}
      data-testid={appearanceSectionTestIds.root}
    >
      <div className={styles.card}>
        <p className={styles.label} id={themeLabelId}>
          Theme
        </p>
        <div className={styles.themes} role="radiogroup" aria-labelledby={themeLabelId}>
          {THEME_MODES.map((theme) => (
            <label key={theme} className={styles.theme}>
              <input
                className={styles.radio}
                type="radio"
                name={`${groupName}-theme`}
                checked={appearance.theme === theme}
                onChange={() => chooseTheme(theme)}
                data-testid={appearanceSectionTestIds.theme(theme)}
              />
              <span className={styles.themeFace}>
                <StrokeIcon name={THEME_ICONS[theme]} size={15} />
                {THEME_MODE_NAMES[theme]}
              </span>
            </label>
          ))}
        </div>
        <p className={styles.line} data-testid={appearanceSectionTestIds.themeLine}>
          {themeLine(appearance.theme, deviceIsDark)}
        </p>
      </div>

      <div className={styles.card}>
        <p className={styles.label} id={accentLabelId}>
          Accent colour
        </p>
        <div className={styles.accents} role="radiogroup" aria-labelledby={accentLabelId}>
          {ACCENT_COLOURS.map((accentColour) => {
            const chosen = appearance.accentColour === accentColour;
            const palette = ACCENT_PALETTES[accentColour];
            return (
              <label key={accentColour} className={styles.accent}>
                <input
                  className={styles.radio}
                  type="radio"
                  name={`${groupName}-accent`}
                  checked={chosen}
                  onChange={() => chooseAccent(accentColour)}
                  data-testid={appearanceSectionTestIds.accent(accentColour)}
                />
                <span className={styles.accentFace}>
                  <span
                    className={styles.swatch}
                    aria-hidden="true"
                    style={{ background: dark ? palette.dark.mark : palette.light.brand }}
                  >
                    {chosen && (
                      <span
                        className={styles.check}
                        style={{ color: dark ? "var(--ground)" : "#ffffff" }}
                        data-testid={appearanceSectionTestIds.accentCheck}
                      >
                        <StrokeIcon name="check" size={16} />
                      </span>
                    )}
                  </span>
                  {ACCENT_COLOUR_NAMES[accentColour]}
                </span>
              </label>
            );
          })}
        </div>
        <p className={styles.line}>
          Used for buttons, progress, search hits and the logo. Warnings keep their own colour, so a failure always
          looks like one.
        </p>
      </div>

      <p className={styles.status} role="status" aria-live="polite" data-testid={appearanceSectionTestIds.status}>
        {status}
      </p>
    </div>
  );
}
