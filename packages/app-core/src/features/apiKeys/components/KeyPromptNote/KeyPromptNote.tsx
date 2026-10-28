import { Link } from "react-router";
import type { Provider } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import type { GenerationReadiness } from "../../../newOverview/useGenerationReadiness.js";
import { useUpdateSettingsMutation } from "../../../settings/mutations/useUpdateSettingsMutation.js";
import { ADD_A_KEY_IN_SETTINGS, addKeyLabel, keyPrompt, useInsteadLabel } from "../../keyPrompt.js";
import styles from "./KeyPromptNote.module.scss";
import type { KeyPromptNoteTestIds } from "./KeyPromptNoteTestIds.js";

export interface KeyPromptNoteProps {
  readiness: GenerationReadiness;
  // The words under the heading. The home hero and the dialog name the six providers; the
  // extension's capture screen keeps the full standing note (designs 110k, 110l, 110m).
  detail: string;
  from: "home" | "dialog" | "panel";
  testIds: KeyPromptNoteTestIds;
  onFollowed?: () => void;
}

// The one block every surface outside Settings shows in place of its generate button. A
// button that cannot work is replaced, never disabled (design 110k).
export function KeyPromptNote({ readiness, detail, from, testIds, onFollowed }: KeyPromptNoteProps) {
  const analytics = useAnalytics();
  const updateSettings = useUpdateSettingsMutation();
  const prompt = keyPrompt(readiness, { surface: useSurface(), isPhone: useIsPhone(), detail });

  if (prompt === null) {
    return null;
  }

  const followSettings = () => {
    analytics.capture.newOverviewForm.keysLinkFollowed({ from });
    onFollowed?.();
  };

  const useInstead = (fallback: Provider) => {
    analytics.settings.apiKeys.providerChosen({ provider: fallback, from: "no-key-here" });
    updateSettings.mutate({ provider: fallback });
  };

  return (
    <div className={styles.root} data-testid={testIds.root}>
      <p className={styles.heading} data-testid={testIds.heading}>
        {prompt.heading}
      </p>
      <p className={styles.detail} data-testid={testIds.detail}>
        {prompt.detail}
      </p>

      {prompt.kind === "no-key" ? (
        <Link
          className={styles.link}
          to={Routes.settingsSection("keys")}
          onClick={followSettings}
          data-testid={testIds.settingsLink}
        >
          {ADD_A_KEY_IN_SETTINGS} <StrokeIcon name="arrowRight" size={15} />
        </Link>
      ) : (
        <>
          <div className={styles.ways}>
            <Link
              className={styles.addKey}
              to={Routes.settingsSection("keys")}
              onClick={followSettings}
              data-testid={testIds.addKey}
            >
              {addKeyLabel(prompt.provider)}
            </Link>
            <button
              type="button"
              className={styles.useFallback}
              onClick={() => useInstead(prompt.fallback)}
              data-testid={testIds.useFallback}
            >
              {useInsteadLabel(prompt.fallback)}
            </button>
          </div>
          <p className={styles.footnote} data-testid={testIds.footnote}>
            {prompt.footnote}
          </p>
        </>
      )}
    </div>
  );
}
