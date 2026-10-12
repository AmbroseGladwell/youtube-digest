import { useCallback, useEffect, useRef, useState } from "react";
import { listProviderModels } from "@overview/generation";
import { modelFor, PROVIDER_SHORT_LABEL, type Provider } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import {
  catalogueIsStale,
  readCatalogues,
  writeCatalogue,
  type ModelCatalogue,
} from "../../../apiKeys/ModelCatalogue.js";
import { matchingChoices, modelChoices, type ModelChoice } from "../../../apiKeys/modelChoices.js";
import { useUpdateSettingsMutation } from "../../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../queries/settingsQuery.js";
import styles from "./ModelPickerDialog.module.scss";
import { modelPickerDialogTestIds } from "./ModelPickerDialogTestIds.js";

export interface ModelPickerDialogProps {
  // Null is closed. The dialog is mounted by the panel, which holds the key it reads.
  provider: Provider | null;
  apiKey: string | null;
  onClose: () => void;
}

// Design 110e: the rest of the catalogue opens five at a time, because OpenAI's own list
// runs past a hundred and a reader looking for one of them is searching, not scrolling.
const FIRST_FEW = 5;

const HEADING_ID = "ModelPickerDialog-heading";

export function ModelPickerDialog({ provider, apiKey, onClose }: ModelPickerDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const analytics = useAnalytics();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const [catalogue, setCatalogue] = useState<ModelCatalogue | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Native <dialog> rather than a hand-rolled overlay, for the same reason
  // NewOverviewDialog uses one: showModal() makes the page behind it inert, keeps focus
  // inside, and turns Escape into a cancel event.
  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (provider !== null && !element.open) {
      element.showModal();
    }
    if (provider === null && element.open) {
      element.close();
    }
  }, [provider]);

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
      // The key works — it was accepted when it was saved. Only the catalogue call failed,
      // so the picker quietly shows the models we know and says so in one muted line
      // (design 110h). Nothing here is an error state.
      analytics.settings.apiKeys.modelsListFailed({ provider });
      setCatalogue(undefined);
    }
  }, [analytics, apiKey, provider]);

  // Refetched when the picker opens and the stored list is more than a day old.
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

  const choices = modelChoices(provider ?? "anthropic", catalogue);
  const name = provider === null ? "" : PROVIDER_SHORT_LABEL[provider];
  const chosen = provider === null ? "" : modelFor(settingsQuery.data?.modelByProvider ?? {}, provider);

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

  // role="radio" rather than the design's listbox option: the choice is one of several and
  // saves straight away, which is what a radio means, and a <button> is focusable and
  // answers Enter and Space without a key handler of its own.
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
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      data-testid={modelPickerDialogTestIds.root}
    >
      {provider !== null && (
        <div className={styles.panel}>
          <div className={styles.head}>
            <h2 className={styles.heading} id={HEADING_ID} data-testid={modelPickerDialogTestIds.heading}>
              Model for {name}
            </h2>
            <button
              type="button"
              className={styles.close}
              aria-label="Close"
              onClick={onClose}
              data-testid={modelPickerDialogTestIds.close}
            >
              <StrokeIcon name="close" size={18} />
            </button>
          </div>

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
              These are the models we know for {name}. {name} didn’t send its full list just now, so a newer one may
              be missing.{" "}
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
            ≈ is roughly what {name} charges your key for a 20-minute video, in US dollars, which is what every one
            of these providers bills in. Longer videos cost more.
          </p>

          {/* Dropped rather than shown empty when the catalogue call failed: a group that
              says nothing is a control that cannot work (design 110h). */}
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
              Not listed: {choices.unusable} more that can’t write an overview, such as image, audio and embedding
              models.
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}
