import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ChatStore, OverviewId } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { chatKeys } from "../chatKeys.js";

export const chatsQueryOptions = (chatStore: ChatStore, overviewId: OverviewId) =>
  queryOptions({
    queryKey: chatKeys.list(overviewId),
    queryFn: () => chatStore.listChats({ kind: "overview", id: overviewId }),
  });

export const useChatsQuery = (overviewId: OverviewId) => {
  const { chatStore } = useStores();
  return useQuery(chatsQueryOptions(chatStore, overviewId));
};
