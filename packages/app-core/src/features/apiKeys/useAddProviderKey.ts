import { useCallback, useState } from "react";
import { listProviderModels, ProviderKeyRefusedError } from "@overview/generation";
import { DEFAULT_MODEL, PROVIDER_SHORT_LABEL, type Provider } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { providersWithKeys } from "./ApiKeys.js";
import { writeCatalogue } from "./ModelCatalogue.js";
import { useProviderPermissions } from "./ProviderPermissionContext.js";
import { useApiKeys } from "./useApiKeys.js";

// Saving is two beats, and the second one can fail: the key is checked and the model list
// fetched in the same call, because the only honest check that a key works is using it
// (design 110d). Chrome's permission, where there is one, comes before both.
export type AddKeyState =
  | { step: "idle" }
  | { step: "permission" }
  | { step: "checking" }
  | { step: "refused" }
  | { step: "permission-denied" }
  | { step: "failed"; message: string }
  | { step: "saved"; models: number; model: string };

export function useAddProviderKey(provider: Provider) {
  const [state, setState] = useState<AddKeyState>({ step: "idle" });
  const { apiKeys, saveKey } = useApiKeys();
  const permissions = useProviderPermissions();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();

  const reset = useCallback(() => setState({ step: "idle" }), []);

  const add = useCallback(
    async (key: string) => {
      if (permissions !== null && !(await permissions.granted(provider))) {
        setState({ step: "permission" });
        if (!(await permissions.request(provider))) {
          setState({ step: "permission-denied" });
          return;
        }
      }

      setState({ step: "checking" });
      try {
        const listing = await listProviderModels(provider, key);
        // The first key saved becomes what generation runs on; later ones never change it
        // (design 110d). A reader who adds a second provider to compare has not asked for
        // their next overview to be made with it.
        const becameChoice = providersWithKeys(apiKeys).length === 0;
        const model = settingsQuery.data?.modelByProvider[provider] ?? DEFAULT_MODEL[provider];

        saveKey(provider, key);
        writeCatalogue(provider, { ...listing, fetchedAt: new Date().toISOString() });
        updateSettings.mutate({
          ...(becameChoice ? { provider } : {}),
          modelByProvider: { [provider]: model },
        });

        analytics.settings.apiKeys.keySaved({ provider, modelsListed: listing.usable.length, becameChoice });
        setState({ step: "saved", models: listing.usable.length, model });
      } catch (error) {
        if (error instanceof ProviderKeyRefusedError) {
          analytics.settings.apiKeys.keyRefused({ provider });
          setState({ step: "refused" });
          return;
        }
        setState({
          step: "failed",
          message: `${PROVIDER_SHORT_LABEL[provider]} could not be reached just now. Try again in a moment.`,
        });
      }
    },
    [apiKeys, analytics, permissions, provider, saveKey, settingsQuery.data, updateSettings],
  );

  return { state, add, reset };
}
