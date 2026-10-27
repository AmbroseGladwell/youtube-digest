import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { hasKeyFor } from "../apiKeys/ApiKeys.js";
import { useOverviewUsageQuery } from "../newOverview/queries/overviewUsageQuery.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSignedOutTrial } from "../signedOutTrial/useSignedOutTrial.js";
import { useSync } from "../sync/SyncContext.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { DEFAULT_PROVIDER } from "@overview/domain";
import type { PlanUsageProps } from "./components/PlanUsage/PlanUsage.js";

// What Settings › Plan counts: the account's month signed in, the device's trial signed out
// where this shell has one, and nothing where it hasn't.
export function usePlanUsage(): PlanUsageProps | null {
  const { connection } = useSyncConnection();
  const accountsAvailable = useSync().available;
  const usage = useOverviewUsageQuery();
  const trial = useSignedOutTrial();
  const { apiKeys } = useApiKeys();
  const provider = useSettingsQuery().data?.provider ?? DEFAULT_PROVIDER;

  if (!isConnected(connection)) {
    return accountsAvailable ? { signedIn: false, trialMade: trial.made } : null;
  }
  return {
    signedIn: true,
    hasOwnKey: hasKeyFor(apiKeys, provider),
    usage:
      usage.data !== undefined
        ? { status: "known", data: usage.data }
        : { status: usage.isError ? "unreachable" : "checking" },
  };
}
