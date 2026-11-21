import { useId, useState } from "react";
import { useHref } from "react-router";
import {
  ACCENT_COLOUR_NAMES,
  ACCENT_COLOURS,
  ACCENT_PALETTES,
  FOLLOW_UP_ASSISTANTS,
  THEME_MODE_NAMES,
  THEME_MODES,
  type AccentColour,
  type FollowUpAssistant,
  type ThemeMode,
} from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { CHROME_EXTENSION_URL } from "../../../../util/chromeExtensionUrl.js";
import { useExtensionOffered } from "../../../../util/useExtensionOffered.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { applyAppearance } from "../../../appearance/applyAppearance.js";
import { writeAppearance, type Appearance } from "../../../appearance/appearanceStorage.js";
import appearanceStyles from "../../../appearance/components/AppearanceSection/AppearanceSection.module.scss";
import { useAppearance } from "../../../appearance/useAppearance.js";
import { useUpdateSettingsMutation } from "../../../settings/mutations/useUpdateSettingsMutation.js";
import styles from "./OnboardingSetups.module.scss";
import { onboardingSetupsTestIds } from "./OnboardingSetupsTestIds.js";

type Setup = "appearance" | "extension" | "ai";

const SETUP_TITLES: Record<Setup, { title: string; line: string }> = {
  appearance: { title: "Appearance", line: "Instant, and it's how your overview will look" },
  extension: { title: "Add content in 1 click", line: "The Overview for Chrome, from any page you're on" },
  ai: { title: "Connect your AI", line: "Ask about your library in Claude or ChatGPT, as well as here" },
};

const THEME_ICONS: Record<ThemeMode, StrokeIconName> = { system: "monitor", light: "sun", dark: "moon" };

const CONNECTABLE: ReadonlyArray<{ assistant: FollowUpAssistant; line: string }> = [
  { assistant: "claude", line: "Add The Overview as a connector" },
  { assistant: "chatgpt", line: "Add The Overview as an app" },
];

export type OnboardingSetup = "appearance" | "extension" | "connect";

export interface OnboardingSetupsProps {
  ready: boolean;
  // A set-up the reader used, for the wait's analytics.
  onOpened?: ((setup: OnboardingSetup) => void) | undefined;
}

// Moment 4 (designs 327m, 327r-6): set-ups beside the wait, moved only by the reader. The
// extension's card shows only where it can be added (useExtensionOffered).
export function OnboardingSetups({ ready, onOpened }: OnboardingSetupsProps) {
  const extensionShown = useExtensionOffered();
  const setups: readonly Setup[] = extensionShown ? ["appearance", "extension", "ai"] : ["appearance", "ai"];
  const [at, setAt] = useState(0);
  const shownAt = Math.min(at, setups.length - 1);
  const setup = setups[shownAt] ?? "appearance";
  const headingId = useId();
  const move = (by: number) => setAt((shownAt + by + setups.length) % setups.length);

  return (
    <div className={styles.root} data-testid={onboardingSetupsTestIds.root}>
      <div className={styles.intro}>
        <h2 id={headingId} className={styles.heading} data-testid={onboardingSetupsTestIds.heading}>
          {ready ? "A few quick set-ups." : "While it's writing, a few quick set-ups."}
        </h2>
        <p className={styles.lead}>
          {ready ? "Finish any you started. All in Settings later." : "All optional, and all in Settings later."}
        </p>
      </div>

      <section className={styles.carousel} aria-roledescription="carousel" aria-labelledby={headingId}>
        <div
          key={setup}
          className={styles.slide}
          role="group"
          aria-roledescription="slide"
          aria-label={`${SETUP_TITLES[setup].title}, ${shownAt + 1} of ${setups.length}`}
          data-testid={onboardingSetupsTestIds.card(setup)}
        >
          <span className={styles.title}>{SETUP_TITLES[setup].title}</span>
          <p className={styles.line}>{SETUP_TITLES[setup].line}</p>
          {setup === "appearance" && <AppearanceSetup onOpened={() => onOpened?.("appearance")} />}
          {setup === "extension" && <ExtensionSetup onOpened={() => onOpened?.("extension")} />}
          {setup === "ai" && <ConnectSetup onOpened={() => onOpened?.("connect")} />}
        </div>

        <div className={styles.nav}>
          <span className={styles.count} aria-live="polite" data-testid={onboardingSetupsTestIds.count}>
            {shownAt + 1} of {setups.length}
          </span>
          <span className={styles.dots} aria-hidden="true">
            {setups.map((each, index) => (
              <i key={each} className={index === shownAt ? styles.dotOn : styles.dot} />
            ))}
          </span>
          <span className={styles.arrows}>
            <button
              type="button"
              className={styles.arrow}
              aria-label="Previous set-up"
              onClick={() => move(-1)}
              data-testid={onboardingSetupsTestIds.previous}
            >
              <StrokeIcon name="chevronLeft" size={18} />
            </button>
            <button
              type="button"
              className={styles.arrow}
              aria-label="Next set-up"
              onClick={() => move(1)}
              data-testid={onboardingSetupsTestIds.next}
            >
              <StrokeIcon name="chevronRight" size={18} />
            </button>
          </span>
        </div>
      </section>
    </div>
  );
}

// Settings › Appearance's Theme and Accent colour (designs 135a–135d), painted by its own
// stylesheet and saved the same way, so a choice here is the one Settings shows.
function AppearanceSetup({ onOpened }: { onOpened: () => void }) {
  const saved = useAppearance();
  const updateSettings = useUpdateSettingsMutation();
  const appearance = updateSettings.isPending ? { ...saved, ...updateSettings.variables } : saved;
  const analytics = useAnalytics();
  const deviceIsDark = useMediaQuery("(prefers-color-scheme: dark)");
  const groupName = useId();
  const themeLabelId = useId();
  const accentLabelId = useId();
  const [status, setStatus] = useState("");
  const dark = appearance.theme === "dark" || (appearance.theme === "system" && deviceIsDark);

  const choose = (patch: Partial<Appearance>, said: string) => {
    const next = { ...appearance, ...patch };
    applyAppearance(next);
    writeAppearance(next);
    setStatus(said);
    onOpened();
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
    <div className={styles.appearance}>
      <p className={styles.visuallyHidden} id={themeLabelId}>
        Theme
      </p>
      <div className={`${appearanceStyles.themes} ${styles.themes}`} role="radiogroup" aria-labelledby={themeLabelId}>
        {THEME_MODES.map((theme) => (
          <label key={theme} className={appearanceStyles.theme}>
            <input
              className={appearanceStyles.radio}
              type="radio"
              name={`${groupName}-theme`}
              checked={appearance.theme === theme}
              onChange={() => chooseTheme(theme)}
              data-testid={onboardingSetupsTestIds.theme(theme)}
            />
            <span className={appearanceStyles.themeFace}>
              <StrokeIcon name={THEME_ICONS[theme]} size={15} />
              {THEME_MODE_NAMES[theme]}
            </span>
          </label>
        ))}
      </div>

      <p className={styles.accentLabel} id={accentLabelId}>
        Accent colour
      </p>
      <div className={appearanceStyles.accents} role="radiogroup" aria-labelledby={accentLabelId}>
        {ACCENT_COLOURS.map((accentColour) => {
          const chosen = appearance.accentColour === accentColour;
          const palette = ACCENT_PALETTES[accentColour];
          return (
            <label key={accentColour} className={appearanceStyles.accent}>
              <input
                className={appearanceStyles.radio}
                type="radio"
                name={`${groupName}-accent`}
                checked={chosen}
                onChange={() => chooseAccent(accentColour)}
                data-testid={onboardingSetupsTestIds.accent(accentColour)}
              />
              <span className={`${appearanceStyles.accentFace} ${styles.accentFace}`}>
                <span
                  className={appearanceStyles.swatch}
                  aria-hidden="true"
                  style={{ background: dark ? palette.dark.mark : palette.light.brand }}
                >
                  {chosen && (
                    <span className={appearanceStyles.check} style={{ color: dark ? "var(--ground)" : "#ffffff" }}>
                      <StrokeIcon name="check" size={14} />
                    </span>
                  )}
                </span>
                {ACCENT_COLOUR_NAMES[accentColour]}
              </span>
            </label>
          );
        })}
      </div>

      <p className={styles.visuallyHidden} role="status" aria-live="polite" data-testid={onboardingSetupsTestIds.status}>
        {status}
      </p>
    </div>
  );
}

function ExtensionSetup({ onOpened }: { onOpened: () => void }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <b className={styles.rowName}>Chrome extension</b>
        <small className={styles.rowLine}>Takes about 30 seconds</small>
      </span>
      <a
        className={styles.rowAction}
        href={CHROME_EXTENSION_URL}
        target="_blank"
        rel="noopener"
        aria-label="Add to Chrome, opens in a new tab"
        onClick={onOpened}
        data-testid={onboardingSetupsTestIds.addToChrome}
      >
        Add to Chrome
      </a>
    </div>
  );
}

// Each opens Settings › Connections in a new tab, so the run in this one carries on, with the
// chosen assistant's steps already showing there (OV-301).
function ConnectSetup({ onOpened }: { onOpened: () => void }) {
  const connectionsHref = useHref(Routes.settingsSection("connections"));
  const updateSettings = useUpdateSettingsMutation();
  return (
    <div className={styles.rows}>
      {CONNECTABLE.map(({ assistant, line }) => (
        <div key={assistant} className={styles.row}>
          <span className={styles.rowText}>
            <b className={styles.rowName}>{FOLLOW_UP_ASSISTANTS[assistant].name}</b>
            <small className={styles.rowLine}>{line}</small>
          </span>
          <a
            className={styles.rowAction}
            href={connectionsHref}
            target="_blank"
            rel="noopener"
            aria-label={`Connect ${FOLLOW_UP_ASSISTANTS[assistant].name}, opens in a new tab`}
            onClick={() => {
              onOpened();
              updateSettings.mutate({ followUpAssistant: assistant });
            }}
            data-testid={onboardingSetupsTestIds.connect(assistant)}
          >
            Connect
          </a>
        </div>
      ))}
    </div>
  );
}
