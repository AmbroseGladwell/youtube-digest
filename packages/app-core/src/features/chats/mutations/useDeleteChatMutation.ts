import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatOwnerOfId, type Chat } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { chatKeys } from "../chatKeys.js";

export interface DeleteChatVariables {
  // The list it is shown in: an overview's conversations, or the Ask page's.
  listKey: readonly unknown[];
  chatId: string;
}

// Gone from the list at once; the store journals the delete and sync takes it to the server
// and every other device (docs/features/chats.md, "Deleting").
export function useDeleteChatMutation() {
  const { chatStore } = useStores();
  const queryClient = useQueryClient();
  return useMutation<void, Error, DeleteChatVariables, { previous: Chat[] | undefined }>({
    mutationFn: ({ chatId }) => chatStore.deleteChat(chatId),
    onMutate: async ({ listKey, chatId }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Chat[]>(listKey);
      queryClient.setQueryData<Chat[]>(listKey, (current) => current?.filter((chat) => chat.id !== chatId));
      return { previous };
    },
    onError: (_error, { listKey }, context) => {
      if (context !== undefined) queryClient.setQueryData(listKey, context.previous);
    },
    // An overview's conversation is in both its own list and the Ask drawer's (OV-363).
    onSettled: (_data, _error, { listKey, chatId }) => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      void queryClient.invalidateQueries({ queryKey: chatKeys.asked() });
      const owner = chatOwnerOfId(chatId);
      if (owner?.kind === "overview") void queryClient.invalidateQueries({ queryKey: chatKeys.list(owner.id) });
    },
  });
}
