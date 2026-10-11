import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { listProviderModels } from "@overview/generation";
import { modelFor, Provider, PROVIDER_SHORT_LABEL } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { catalogueIsStale, readCatalogues, writeCatalogue, type ModelCatalogue } from "../../apiKeys/ModelCatalogue.js";
import { matchingChoices, modelChoices, type ModelChoice } from "../../apiKeys/modelChoices.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { useUpdateSettingsMutation } from "../mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../queries/settingsQuery.js";
import styles from "./ModelPickerPage.module.scss";
import { modelPickerPageTestIds } from "./ModelPickerPageTestIds.js";

// Design 110e: the rest of the catalogue opens five at a time, because OpenAI's own list
// runs past a hundred and a reader looking for one of them is searching, not scrolling.
const FIRST_FEW = 5;

export function ModelPickerPage() {
  const params = useParams();
  const parsed = Provider.safeParse(params.provider);
  const { apiKeys } = useApiKeys();
  const stored = parsed.success ? apiKeys.keys[parsed.data] : undefined;

  if (!parsed.success || stored === undefined) {
    // A provider this device holds no key for has no catalogue to show and no model worth
    // choosing, so the address behaves as if it were not there.
    return <ErrorState screen="notFound" title="There's nothing at this address" back />;
  }

  return <ModelPicker provider={parsed.data} apiKey={stored.key} />;
}

function ModelPicker({ provider, apiKey }: { provider: Provider; apiKey: string }) {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const [catalogue, setCatalogue] = useState<ModelCatalogue | undefined>(() => readCatalogues()[provider]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const name = PROVIDER_SHORT_LABEL[provider];
  const chosen = modelFor(settingsQuery.data?.modelByProvider ?? {}, provider);

  const refetch = useCallback(async () => {
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

  useEffect(() => {
    const held = readCatalogues()[provider];
    if (held === undefined || catalogueIsStale(held, new Date())) {
      void refetch();
    }
  }, [provider, refetch]);

  const choices = modelChoices(provider, catalogue);
  const searching = search.trim() !== "";
  const matchedRecommended = matchingChoices(choices.recommended, search);
  const matchedRest = matchingChoices(choices.rest, search);
  const shownRest = searching || showAll ? matchedRest : matchedRest.slice(0, FIRST_FEW);

  const choose = (choice: ModelChoice) => {
    analytics.settings.apiKeys.modelChosen({ provider, known: choice.description !== null });
    updateSettings.mutate({ modelByProvider: { [provider]: choice.id } });
    void navigate(Routes.settingsSection("keys"));
  };

  const row = (choice: ModelChoice) => (
    <li key={choice.id}>
      <button
        type="button"
        className={`${styles.choice} ${choice.id === chosen ? styles.chosen : ""}`}
        aria-current={choice.id === chosen ? "true" : undefined}
        onClick={() => choose(choice)}
        data-testid={modelPickerPageTestIds.choice(choice.id)}
      >
        <span className={styles.choiceHead}>
          <span className={choice.description === null ? styles.raw : styles.choiceLabel}>{choice.label}</span>
          {choice.cents !== null && <span className={styles.cost}>≈ {choice.cents}¢</span>}
        </span>
        {choice.description !== null && <span className={styles.choiceDescription}>{choice.description}</span>}
      </button>
    </li>
  );

  return (
    <div className={styles.root} data-testid={modelPickerPageTestIds.root}>
      <Link className={styles.back} to={Routes.settingsSection("keys")} data-testid={modelPickerPageTestIds.back}>
        <StrokeIcon name="arrowLeft" /> API keys
      </Link>
      <h1 className={styles.heading} data-testid={modelPickerPageTestIds.heading}>
        Model for {name}
      </h1>
      <p className={styles.standfirst} data-testid={modelPickerPageTestIds.standfirst}>
        Choosing saves straight away and applies to new overviews made with your {name} key.
      </p>

      <input
        className={styles.search}
        type="search"
        aria-label="Find a model"
        placeholder="Find a model"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        data-testid={modelPickerPageTestIds.search}
      />

      {choices.source === "known" && (
        <p className={styles.staleNote} data-testid={modelPickerPageTestIds.staleNote}>
          These are the models we know for {name}. {name} didn’t send its full list just now, so a newer one may be
          missing.{" "}
          <button type="button" className={styles.recheck} onClick={() => void refetch()} data-testid={modelPickerPageTestIds.recheck}>
            Check again
          </button>
        </p>
      )}

      {searching ? (
        <p className={styles.standfirst} data-testid={modelPickerPageTestIds.searchCount}>
          {matchedRecommended.length + matchedRest.length} matching “{search.trim()}”
        </p>
      ) : (
        <p className={styles.groupLabel} data-testid={modelPickerPageTestIds.recommendedLabel}>
          {choices.source === "known" ? "Models we know" : "Recommended"}
        </p>
      )}

      <ul className={styles.list}>{matchedRecommended.map(row)}</ul>

      <p className={styles.costNote} data-testid={modelPickerPageTestIds.costNote}>
        ≈ is roughly what {name} charges your key for a 20-minute video. Longer videos cost more.
      </p>

      {/* Dropped rather than shown empty when the catalogue call failed: a group that says
          nothing is a control that cannot work (design 110h). */}
      {choices.rest.length > 0 && (
        <>
          {!searching && (
            <p className={styles.groupLabel} data-testid={modelPickerPageTestIds.restLabel}>
              Everything else your key can reach · {choices.rest.length}
            </p>
          )}
          {!searching && (
            <p className={styles.standfirst}>
              As listed by {name}. We haven’t tested these, so they have no description or cost.
            </p>
          )}
          <ul className={styles.list}>{shownRest.map(row)}</ul>
          {!searching && !showAll && matchedRest.length > FIRST_FEW && (
            <button
              type="button"
              className={styles.showAll}
              onClick={() => setShowAll(true)}
              data-testid={modelPickerPageTestIds.showAll}
            >
              Show all {matchedRest.length}
            </button>
          )}
        </>
      )}

      {choices.unusable > 0 && !searching && (
        <p className={styles.notListed} data-testid={modelPickerPageTestIds.notListed}>
          Not listed: {choices.unusable} more that can’t write an overview, such as image, audio and embedding
          models.
        </p>
      )}
    </div>
  );
}
