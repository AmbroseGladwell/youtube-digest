import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ChatStore, ProjectStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { chatKeys } from "../chatKeys.js";

// The Ask page's conversations as this device holds them: the library's, then each project's,
// archived ones too. An overview's own chats stay in that overview (OV-354, page 3).
export const askChatsQueryOptions = (chatStore: ChatStore, projectStore: ProjectStore) =>
  queryOptions({
    queryKey: chatKeys.asked(),
    queryFn: async () => {
      const projects = await projectStore.listProjects();
      const lists = await Promise.all([
        chatStore.listChats({ kind: "library" }),
        ...projects.map((project) => chatStore.listChats({ kind: "project", id: project.id })),
      ]);
      return lists.flat();
    },
  });

export const useAskChatsQuery = () => {
  const { chatStore, projectStore } = useStores();
  return useQuery(askChatsQueryOptions(chatStore, projectStore));
};
