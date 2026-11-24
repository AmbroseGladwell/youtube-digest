import { useQuery } from "@tanstack/react-query";
import { useStores } from "../../stores/StoresContext.js";
import { chatKeys } from "../chats/chatKeys.js";
import { projectMembersQueryOptions } from "../projects/queries/projectMembersQuery.js";
import { libraryActivityOf, NO_LIBRARY_ACTIVITY, type LibraryActivity } from "./util/libraryEntryDate.js";

// Read only while the list sorts by Updated, so other orders never load every chat.
export const useLibraryActivity = (needed: boolean): LibraryActivity => {
  const { chatStore, projectStore } = useStores();
  const members = useQuery({ ...projectMembersQueryOptions(projectStore), enabled: needed });
  const chats = useQuery({ queryKey: chatKeys.every(), queryFn: () => chatStore.listEveryChat(), enabled: needed });
  if (!needed) {
    return NO_LIBRARY_ACTIVITY;
  }
  return libraryActivityOf(members.data ?? [], chats.data ?? []);
};
