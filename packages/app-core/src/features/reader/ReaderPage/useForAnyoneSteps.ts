import { useEffect, useRef, useState } from "react";
import { composeReaderContext, DEFAULT_PROVIDER, modelFor, sourceName, type Overview } from "@overview/domain";
import { generateForAnyoneSteps } from "@overview/generation";
import { createFetchGenerationApi } from "@overview/sync";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { createGenerationClient } from "../../newOverview/api/generationClients.js";
import { readNextSteps, writeNextSteps } from "../../onboarding/nextStepsStorage.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";

export type ForAnyoneSteps = { status: "hidden" } | { status: "writing" } | { status: "ready"; items: readonly string[] };

const HIDDEN: ForAnyoneSteps = { status: "hidden" };

const remembered = (overview: Overview | null): ForAnyoneSteps | null => {
  const held = readNextSteps();
  if (overview === null || held === null || held.overviewId !== overview.id) return HIDDEN;
  if (held.forAnyone === "failed" || held.sample) return HIDDEN;
  return held.forAnyone === null ? null : { status: "ready", items: held.forAnyone };
};

// On the reveal only, written once and kept with the reveal's other device-local state: a reload
// never pays for it twice, and a failure hides the control for good rather than retrying
// (docs/features/personalisation.md, "Written for you").
export function useForAnyoneSteps(overview: Overview | null): ForAnyoneSteps {
  const settings = useSettingsQuery().data;
  const { apiKeys } = useApiKeys();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const analytics = useAnalytics();
  const asked = useRef<string | null>(null);
  const [steps, setSteps] = useState<ForAnyoneSteps | null>(null);

  const held = remembered(overview);
  const personal = settings !== undefined && composeReaderContext(settings.aboutYou, settings.learned) !== null;
  const hasSteps = (overview?.howToApply?.items.length ?? 0) > 0;
  const due = held === null && personal && hasSteps;

  useEffect(() => {
    if (!due || overview === null || settings === undefined || asked.current === overview.id) return;
    asked.current = overview.id;
    setSteps({ status: "writing" });
    const provider = settings.provider ?? DEFAULT_PROVIDER;
    const apiKey = apiKeys.keys[provider]?.key;
    const input = {
      title: overview.source.title,
      channel: sourceName(overview.source),
      inOneLine: overview.inOneLine,
      coreClaim: overview.coreClaim,
      keyPoints: overview.keyPoints.map(({ text }) => text),
    };
    const write = async () => {
      if (overview.madeOn?.key === "own" && apiKey !== undefined) {
        return generateForAnyoneSteps(createGenerationClient(provider, apiKey, modelFor(settings.modelByProvider, provider)), input);
      }
      if (knownApiUrl === null || libraryAccountIdOf(connection) === null) throw new Error("No key can write this");
      return (await createFetchGenerationApi({ baseUrl: knownApiUrl, token: connection.token }).forAnyone(input)).items;
    };
    const remember = (forAnyone: string[] | "failed") => {
      const current = readNextSteps();
      if (current !== null) writeNextSteps({ ...current, forAnyone });
    };
    write()
      .then((items) => {
        if (items.length === 0) throw new Error("Nothing written");
        remember(items);
        analytics.onboarding.writtenForYou.shown();
        setSteps({ status: "ready", items });
      })
      .catch(() => {
        remember("failed");
        analytics.onboarding.writtenForYou.failed();
        setSteps(HIDDEN);
      });
  }, [due, overview, settings, apiKeys, knownApiUrl, connection, analytics]);

  if (steps !== null) return steps;
  return held ?? (due ? { status: "writing" } : HIDDEN);
}
