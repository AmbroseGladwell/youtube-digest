import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Chat, OverviewId } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { chatKeys } from "../chatKeys.js";

export interface DeleteChatVariables {
  overviewId: OverviewId;
  chatId: string;
}

// Gone from the list at once; the store journals the delete and sync takes it to the server
// and every other device (docs/features/chats.md, "Deleting").
export function useDeleteChatMutation() {
  const { chatStore } = useStores();
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeleteChatVariables, { previous: Chat[] | undefined }>({
    mutationFn: ({ chatId }) => chatStore.deleteChat(chatId),
    onMutate: async ({ overviewId, chatId }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.list(overviewId) });
      const previous = queryClient.getQueryData<Chat[]>(chatKeys.list(overviewId));
      queryClient.setQueryData<Chat[]>(chatKeys.list(overviewId), (current) => current?.filter((chat) => chat.id !== chatId));
      return { previous };
    },
    onError: (_error, { overviewId }, context) => {
      if (context !== undefined) queryClient.setQueryData(chatKeys.list(overviewId), context.previous);
    },
    onSettled: (_data, _error, { overviewId }) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.list(overviewId) });
    },
  });
}
