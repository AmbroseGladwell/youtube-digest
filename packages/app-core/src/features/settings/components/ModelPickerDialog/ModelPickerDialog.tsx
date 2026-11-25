import { useCallback, useEffect, useState } from "react";
import { listProviderModels } from "@overview/generation";
import { modelFor, PROVIDER_SHORT_LABEL, type Provider } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useKeptWhileClosing } from "../../../../util/useKeptWhileClosing.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { catalogueIsStale, readCatalogues, writeCatalogue, type ModelCatalogue } from "../../../apiKeys/ModelCatalogue.js";
import { matchingChoices, modelChoices, type ModelChoice } from "../../../apiKeys/modelChoices.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./ModelPickerDialog.module.scss";
import { modelPickerDialogTestIds } from "./ModelPickerDialogTestIds.js";

export interface ModelPickerDialogProps {
  // Null is closed.
  provider: Provider | null;
  apiKey: string | null;
  onClose: () => void;
}

// Five at a time: OpenAI's list runs past a hundred, and a reader looking for one is searching.
const FIRST_FEW = 5;

export const ModelPickerDialog = ({ provider, apiKey, onClose }: ModelPickerDialogProps) => {
  const { open, kept } = useKeptWhileClosing(provider);
  const analytics = useAnalytics();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const [catalogue, setCatalogue] = useState<ModelCatalogue | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const refetch = useCallback(async () => {
    if (provider === null || apiKey === null) {
      return;
    }
    try {
      const listing = await listProviderModels(provider, apiKey);
      const fetched = { ...listing, fetchedAt: new Date().toISOString() };
      writeCatalogue(provider, fetched);
      setCatalogue(fetched);
    } catch {
      // The key was accepted when saved; only the catalogue failed, so the models we know are shown.
      analytics.settings.apiKeys.modelsListFailed({ provider });
      setCatalogue(undefined);
    }
  }, [analytics, apiKey, provider]);

  useEffect(() => {
    if (provider === null) {
      return;
    }
    setSearch("");
    setShowAll(false);
    const held = readCatalogues()[provider];
    setCatalogue(held);
    if (held === undefined || catalogueIsStale(held, new Date())) {
      void refetch();
    }
  }, [provider, refetch]);

  const choices = modelChoices(kept ?? "anthropic", catalogue);
  const name = kept === null ? "" : PROVIDER_SHORT_LABEL[kept];
  const chosen = kept === null ? "" : modelFor(settingsQuery.data?.modelByProvider ?? {}, kept);

  const searching = search.trim() !== "";
  const matchedRecommended = matchingChoices(choices.recommended, search);
  const matchedRest = matchingChoices(choices.rest, search);
  const shownRest = searching || showAll ? matchedRest : matchedRest.slice(0, FIRST_FEW);

  const choose = (choice: ModelChoice) => {
    if (provider === null) {
      return;
    }
    analytics.settings.apiKeys.modelChosen({ provider, known: choice.description !== null });
    updateSettings.mutate({ modelByProvider: { [provider]: choice.id } });
    onClose();
  };

  // A radio, not the design's listbox option, because the choice saves straight away.
  const row = (choice: ModelChoice) => (
    <li key={choice.id}>
      <button
        type="button"
        role="radio"
        aria-checked={choice.id === chosen}
        className={[styles.choice, choice.id === chosen ? styles.chosen : "", choice.description === null ? styles.raw : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => choose(choice)}
        data-testid={modelPickerDialogTestIds.choice(choice.id)}
      >
        <span className={styles.mark} aria-hidden="true">
          {choice.id === chosen && <span className={styles.markDot} />}
        </span>
        <span className={styles.choiceText}>
          <span className={styles.choiceLabel}>{choice.label}</span>
          {choice.description !== null && <span className={styles.choiceDescription}>{choice.description}</span>}
        </span>
        {choice.cents !== null && <span className={styles.cost}>≈ {choice.cents}¢</span>}
      </button>
    </li>
  );

  return (
    <BottomSheet
      open={open}
      title={`Model for ${name}`}
      onClose={onClose}
      wide="dialog"
      width="36.25rem"
      testId={modelPickerDialogTestIds.root}
    >
      {kept !== null && (
        <div className={styles.content}>
          <p className={styles.standfirst} data-testid={modelPickerDialogTestIds.standfirst}>
            Choosing saves straight away and applies to new overviews made with your {name} key.
          </p>

          <div className={styles.search}>
            <StrokeIcon name="search" size={16} />
            <input
              className={styles.searchInput}
              type="search"
              aria-label="Find a model"
              placeholder="Find a model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              data-testid={modelPickerDialogTestIds.search}
            />
          </div>

          {choices.source === "known" && (
            <p className={styles.staleNote} data-testid={modelPickerDialogTestIds.staleNote}>
              These are the models we know for {name}. {name} didn’t send its full list just now, so a newer one may be missing.{" "}
              <button
                type="button"
                className={styles.recheck}
                onClick={() => void refetch()}
                data-testid={modelPickerDialogTestIds.recheck}
              >
                Check again
              </button>
            </p>
          )}

          <div className={styles.group}>
            {searching ? (
              <p className={styles.groupLabel} data-testid={modelPickerDialogTestIds.searchCount}>
                {matchedRecommended.length + matchedRest.length} matching “{search.trim()}”
              </p>
            ) : (
              <p className={styles.groupLabel} data-testid={modelPickerDialogTestIds.recommendedLabel}>
                {choices.source === "known" ? "Models we know" : "Recommended"}
              </p>
            )}
            <ul className={styles.list} role="radiogroup" aria-label={`Model for ${name}`}>
              {matchedRecommended.map(row)}
            </ul>
          </div>

          <p className={styles.costNote} data-testid={modelPickerDialogTestIds.costNote}>
            ≈ is roughly what {name} charges your key for a 20-minute video, in US dollars, which is what every one of these providers bills
            in. Longer videos cost more.
          </p>

          {/* Dropped rather than shown empty when the catalogue failed (CLAUDE.md, "degrade visibly"). */}
          {choices.rest.length > 0 && (
            <div className={styles.group}>
              {!searching && (
                <p className={styles.groupLabel} data-testid={modelPickerDialogTestIds.restLabel}>
                  Everything else your key can reach · {choices.rest.length}
                </p>
              )}
              <ul className={styles.list} role="radiogroup" aria-label={`Other models for ${name}`}>
                {shownRest.map(row)}
              </ul>
              {!searching && !showAll && matchedRest.length > FIRST_FEW && (
                <button
                  type="button"
                  className={styles.showAll}
                  onClick={() => setShowAll(true)}
                  data-testid={modelPickerDialogTestIds.showAll}
                >
                  Show all {matchedRest.length}
                </button>
              )}
            </div>
          )}

          {choices.unusable > 0 && !searching && (
            <p className={styles.notListed} data-testid={modelPickerDialogTestIds.notListed}>
              Not listed: {choices.unusable} more that can’t write an overview, such as image, audio and embedding models.
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
