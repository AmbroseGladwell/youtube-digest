import { queryOptions, useQuery } from "@tanstack/react-query";
import { chatOwner, type ChatStore, type ProjectStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { chatKeys } from "../chatKeys.js";

// The Ask drawer's conversations as this device holds them: the library's, each project's and
// each overview's (OV-363), archived ones too. A deleted project's are left out.
export const askChatsQueryOptions = (chatStore: ChatStore, projectStore: ProjectStore) =>
  queryOptions({
    queryKey: chatKeys.asked(),
    queryFn: async () => {
      const [projects, chats] = await Promise.all([projectStore.listProjects(), chatStore.listEveryChat()]);
      const projectIds = new Set<string>(projects.map((project) => project.id));
      return chats.filter((chat) => {
        const owner = chatOwner(chat);
        return owner.kind !== "project" || projectIds.has(owner.id);
      });
    },
  });

export const useAskChatsQuery = () => {
  const { chatStore, projectStore } = useStores();
  return useQuery(askChatsQueryOptions(chatStore, projectStore));
};
