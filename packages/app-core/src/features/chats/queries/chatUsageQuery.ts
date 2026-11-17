import { useQuery } from "@tanstack/react-query";
import type { ChatUsage } from "@overview/domain";
import { createFetchChatApi } from "@overview/sync";
import { isConnected, libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { chatKeys } from "../chatKeys.js";

// The account's questions this month against its plan's allowance, as the server counts
// them (docs/architecture/tiers.md, "Questions about an overview").
export function useChatUsageQuery() {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const accountId = libraryAccountIdOf(connection);
  return useQuery({
    queryKey: chatKeys.usage(accountId),
    queryFn: (): Promise<ChatUsage> => createFetchChatApi({ baseUrl: apiUrl!, token: connection.token }).usage(),
    enabled: isConnected(connection) && apiUrl !== null,
    staleTime: 60 * 1000,
    retry: false,
  });
}
