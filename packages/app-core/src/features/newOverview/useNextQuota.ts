import { hasKeyFor } from "../apiKeys/ApiKeys.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { keyOrderFor } from "./util/keyOrderFor.js";
import { leftThisMonthOf, nextQuotaOf, type NextQuota, type NextQuotaContext } from "./util/nextQuota.js";

// What the month's counts mean for this device: the server's counts and the same key order a
// run walks. Only an account is counted: signed out there is nothing to make here.
function useQuotaContext(): NextQuotaContext | null {
  const readiness = useGenerationReadiness();
  const { apiKeys } = useApiKeys();
  const settings = useSettingsQuery().data;
  const usage = useOverviewUsageQuery();
  const { connection } = useSyncConnection();
  const signedIn = isConnected(connection);

  const order = keyOrderFor({
    ourKeyUsable: readiness.ourKeyUsable,
    plan: usage.data?.plan ?? null,
    hasOwnKey: hasKeyFor(apiKeys, readiness.provider),
    onlyMyKey: settings?.onlyMyKey ?? false,
  });

  if (!signedIn) return null;
  return {
    order,
    usage:
      usage.data !== undefined
        ? { status: "known", data: usage.data }
        : { status: usage.isError ? "unreachable" : "checking" },
  };
}

// The quota the next overview will use.
export function useNextQuota(): NextQuota | null {
  const context = useQuotaContext();
  return context === null ? null : nextQuotaOf(context);
}

// What's left this month on every key the next overviews could use, and when more come.
export function useLeftThisMonth(): { left: number; resetsOn: string | null } | null {
  const context = useQuotaContext();
  const left = context === null ? null : leftThisMonthOf(context);
  if (context === null || left === null) return null;
  return { left, resetsOn: context.usage.status === "known" ? context.usage.data.resetsOn : null };
}
