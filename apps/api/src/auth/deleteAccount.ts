import { apiLogLines, redactErrorMessage } from "@overview/domain";
import type { FastifyBaseLogger } from "fastify";
import type { AudioStore } from "../audio/AudioStore.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { PersonEraser } from "../postHog/PersonEraser.js";
import type { AccountId } from "./AccountId.js";
import {
  AccountDeletionsRepository,
  type AccountDeletion,
  type ErasureStepStatus,
  type StepStatuses,
} from "./AccountDeletionsRepository.js";

export interface EraseAccountOptions {
  accountId: AccountId;
  email: string;
  now: Date;
  narrationStore: AudioStore | null;
  personEraser: PersonEraser | null;
}

// One transaction: what the later steps need is captured first, the audit row is written,
// then everything under the account goes. The foreign keys cascade for every table but
// three, which are deleted by hand here (docs/features/account-deletion.md, "What goes").
export async function eraseAccount(
  sql: SqlClient,
  { accountId, email, now, narrationStore, personEraser }: EraseAccountOptions,
): Promise<AccountDeletion> {
  return sql.transaction(async (tx) => {
    const keys = (await tx.query<{ key: string }>("select key from audio_renders where requested_by = $1", [accountId])).map(
      (row) => row.key,
    );
    const linked = await tx.query<{ anonymous_id: string }>(
      "select anonymous_id from magic_links where email = $1 and anonymous_id is not null order by created_at desc limit 1",
      [email],
    );
    const anonymousId = linked[0]?.anonymous_id ?? null;
    const deletion = await new AccountDeletionsRepository(tx).insert({
      accountId,
      anonymousId,
      narrationKeys: keys,
      narration: keys.length === 0 ? "skipped" : narrationStore === null ? "not_configured" : "pending",
      postHogAccount: personEraser === null ? "not_configured" : "pending",
      postHogAnonymous: anonymousId === null ? "skipped" : personEraser === null ? "not_configured" : "pending",
      now,
    });
    await tx.query("delete from audio_renders where requested_by = $1", [accountId]);
    await tx.query("delete from magic_links where email = $1", [email]);
    await tx.query("delete from service_transcript_usage where caller = $1", [`account:${accountId}`]);
    await tx.query("delete from accounts where id = $1", [accountId]);
    return deletion;
  });
}

export interface FinishAccountDeletionOptions {
  narrationStore: AudioStore | null;
  personEraser: PersonEraser | null;
  log: Pick<FastifyBaseLogger, "error">;
  now: () => Date;
  stepTimeoutMs?: number;
}

const STEP_TIMEOUT_MS = 10_000;

const withinTime = <T>(work: Promise<T>, ms: number, step: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${step} did not answer within ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

// The steps outside the transaction, each recorded as it ends. A step that fails is left
// `failed` with its error for `task api:finish-deletions` to retry; a step with nothing
// configured to run it is left `not_configured`, which the same retry picks up once it is.
export async function finishAccountDeletion(
  sql: SqlClient,
  deletion: AccountDeletion,
  { narrationStore, personEraser, log, now, stepTimeoutMs = STEP_TIMEOUT_MS }: FinishAccountDeletionOptions,
): Promise<AccountDeletion> {
  const steps: StepStatuses = {
    narration: deletion.narration,
    postHogAccount: deletion.postHogAccount,
    postHogAnonymous: deletion.postHogAnonymous,
  };
  let lastError: string | null = null;
  const failed = (step: string, error: unknown) => {
    lastError = redactErrorMessage(error instanceof Error ? error.message : String(error));
    log.error(
      apiLogLines.auth.accountDeletionStepFailed({ accountId: deletion.accountId, deletionId: deletion.id, step, error: lastError }),
    );
  };

  if (steps.narration === "pending" || steps.narration === "failed" || steps.narration === "not_configured") {
    if (narrationStore === null) {
      steps.narration = "not_configured";
    } else {
      try {
        for (const key of deletion.narrationKeys) {
          await withinTime(narrationStore.delete(key), stepTimeoutMs, "narration");
        }
        steps.narration = "done";
      } catch (error) {
        steps.narration = "failed";
        failed("narration", error);
      }
    }
  }

  const erase = async (status: ErasureStepStatus, distinctId: string | null, step: string): Promise<ErasureStepStatus> => {
    if (status !== "pending" && status !== "failed" && status !== "not_configured") return status;
    if (distinctId === null) return "skipped";
    if (personEraser === null) return "not_configured";
    try {
      const answer = await withinTime(personEraser.erase(distinctId), stepTimeoutMs, step);
      return answer === "absent" ? "skipped" : "queued";
    } catch (error) {
      failed(step, error);
      return "failed";
    }
  };
  steps.postHogAccount = await erase(steps.postHogAccount, deletion.accountId, "postHogAccount");
  steps.postHogAnonymous = await erase(steps.postHogAnonymous, deletion.anonymousId, "postHogAnonymous");

  return new AccountDeletionsRepository(sql).recordSteps(deletion.id, steps, lastError, now());
}
