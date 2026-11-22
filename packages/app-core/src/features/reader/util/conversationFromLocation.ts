export const CONVERSATION_STATE = "conversation";

export const conversationFromLocation = (state: unknown): string | null => {
  if (typeof state !== "object" || state === null) {
    return null;
  }
  const conversation = (state as Record<string, unknown>)[CONVERSATION_STATE];
  return typeof conversation === "string" && conversation !== "" ? conversation : null;
};
