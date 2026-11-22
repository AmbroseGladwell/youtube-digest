import { useQuery } from "@tanstack/react-query";
import type { ChatUsage } from "@overview/domain";
import { createFetchChatApi } from "@overview/sync";
import { isConnected, libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { chatKeys } from "../chatKeys.js";

// The allowance, as the server counts it: docs/architecture/tiers.md, "Questions about an overview".
export const useChatUsageQuery = () => {
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
};
