import { SUGGESTED_QUESTIONS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";

// Not journaled: the server's delete of the overview or project takes them (docs/features/suggested-questions.md).
export const forgetSuggestedQuestions = async (transaction: IDBTransaction, index: string, parentId: string): Promise<void> => {
  const questions = transaction.objectStore(SUGGESTED_QUESTIONS_STORE);
  for (const key of await promisifyRequest<IDBValidKey[]>(questions.index(index).getAllKeys(parentId))) {
    questions.delete(key);
  }
};
