import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import { serverClientContext } from "../versions/serverClientContext.js";
import { foldSameNameTopics, type TopicNameFold } from "./foldSameNameTopics.js";
import { RecordsRepository } from "./RecordsRepository.js";

export interface DuplicateTopicFold extends TopicNameFold {
  accountId: string;
}

// Once, for the duplicates made before POST /topics folded them: docs/features/topic-filing.md.
export const foldDuplicateTopics = async (sql: SqlClient, now: () => Date = () => new Date()): Promise<DuplicateTopicFold[]> => {
  const accounts = await sql.query<{ account_id: string }>(
    `select account_id from records
     where kind = 'topic' and not deleted
     group by account_id, lower(trim(body ->> 'name')) having count(*) > 1`,
  );
  const records = new RecordsRepository(sql, now);
  const folds: DuplicateTopicFold[] = [];
  for (const accountId of new Set(accounts.map(({ account_id }) => account_id))) {
    const updatedAt = now().toISOString();
    for (const fold of await foldSameNameTopics(records, accountId as AccountId, updatedAt, serverClientContext)) {
      folds.push({ accountId, ...fold });
    }
  }
  return folds;
};
