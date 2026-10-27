import { TRIAL_OVERVIEWS } from "@overview/domain";
import { hasKeyFor } from "../apiKeys/ApiKeys.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSignedOutTrial } from "../signedOutTrial/useSignedOutTrial.js";
import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { keyOrderFor } from "./util/keyOrderFor.js";
import { nextQuotaOf, type NextQuota } from "./util/nextQuota.js";

// The quota the next overview will use, from the server's counts and the same key order a
// run walks. Signed out it is the device's trial, where this shell has one, and nothing is
// counted where it hasn't.
export function useNextQuota(): NextQuota | null {
  const readiness = useGenerationReadiness();
  const { apiKeys } = useApiKeys();
  const settings = useSettingsQuery().data;
  const usage = useOverviewUsageQuery();
  const trial = useSignedOutTrial();
  const { connection } = useSyncConnection();
  const accountsAvailable = useSync().available;
  const signedIn = isConnected(connection);

  const order = keyOrderFor({
    ourKeyUsable: readiness.ourKeyUsable,
    plan: usage.data?.plan ?? null,
    hasOwnKey: hasKeyFor(apiKeys, readiness.provider),
    onlyMyKey: settings?.onlyMyKey ?? false,
  });

  if (!signedIn && !accountsAvailable) return null;
  return nextQuotaOf({
    order,
    trial: signedIn ? null : { made: trial.made, total: TRIAL_OVERVIEWS },
    usage:
      usage.data !== undefined
        ? { status: "known", data: usage.data }
        : { status: usage.isError ? "unreachable" : "checking" },
  });
}
