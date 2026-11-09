import { createHash } from "node:crypto";
import { OVERVIEW_MIGRATIONS, Overview, apiLogLines, readStoredRecord, redactErrorMessage, stampSchemaVersion } from "@overview/domain";
import type { ClaimEmbeddingsRepository, EmbeddedClaim, PendingOverview } from "./ClaimEmbeddingsRepository.js";
import { claimsOf } from "./claimsOf.js";
import type { Embedder } from "./Embedder.js";

export const MAX_EMBED_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [60_000, 10 * 60_000, 60 * 60_000];

export interface EmbeddingLog {
  info(line: object): void;
  warn(line: object): void;
  error(line: object): void;
}

export interface EmbeddingQueueOptions {
  embeddings: ClaimEmbeddingsRepository;
  embedder: Embedder;
  clock: () => Date;
  log: EmbeddingLog;
  runWorkers: boolean;
}

const textHash = (model: string, text: string) => createHash("sha256").update(`${model}\n${text}`).digest("hex");

// Woken by a write and once at start, never on a timer, so an idle server lets Neon suspend
// (docs/features/search-by-meaning.md, "The queue"). What is pending is derived from the
// records themselves, so an overview written while the worker was down is found at start.
export class EmbeddingQueue {
  #options: EmbeddingQueueOptions;
  #running = false;
  #again = false;

  constructor(options: EmbeddingQueueOptions) {
    this.#options = options;
  }

  kick(): void {
    if (!this.#options.runWorkers) {
      return;
    }
    if (this.#running) {
      this.#again = true;
      return;
    }
    this.#running = true;
    void this.#work().finally(() => {
      this.#running = false;
      if (this.#again) {
        this.#again = false;
        this.kick();
      }
    });
  }

  async drain(): Promise<void> {
    await this.#forgetRemoved();
    while (await this.#embedNext()) {}
  }

  async #work(): Promise<void> {
    try {
      await this.drain();
    } catch (error) {
      this.#options.log.error(apiLogLines.meaning.workerStopped({ error: redactErrorMessage(String(error)) }));
    }
  }

  async #forgetRemoved(): Promise<void> {
    const removed = await this.#options.embeddings.forgetRemoved();
    if (removed > 0) {
      this.#options.log.info(apiLogLines.meaning.removed({ overviews: removed }));
    }
  }

  async #embedNext(): Promise<boolean> {
    const { embeddings, clock, log } = this.#options;
    const pending = await embeddings.nextPending(clock(), MAX_EMBED_ATTEMPTS);
    if (pending === null) {
      return false;
    }
    const read = readStoredRecord(stampSchemaVersion(pending.body, pending.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
    if (read.status !== "read") {
      await embeddings.recordFailure(pending, { attempts: MAX_EMBED_ATTEMPTS, notBefore: null, error: `record ${read.status}`, now: clock() });
      log.error(apiLogLines.meaning.embedGaveUp({ overviewId: pending.overviewId, reason: read.status }));
      return true;
    }
    try {
      await this.#embed(pending, claimsOf(read.record));
    } catch (error) {
      await this.#failed(pending, redactErrorMessage(String(error)));
    }
    return true;
  }

  async #embed(pending: PendingOverview, claims: string[]): Promise<void> {
    const { embeddings, embedder, clock, log } = this.#options;
    const known = new Map(
      (await embeddings.claimsOf(pending.accountId, pending.overviewId, embedder.model)).map((claim) => [claim.textHash, claim.vector]),
    );
    const hashes = claims.map((text) => textHash(embedder.model, text));
    const fresh = [...new Set(claims.filter((_, index) => !known.has(hashes[index]!)))];
    const embedded = fresh.length === 0 ? { vectors: [], tokens: 0 } : await embedder.embed(fresh);
    fresh.forEach((text, index) => known.set(textHash(embedder.model, text), embedded.vectors[index]!));
    const stored: EmbeddedClaim[] = hashes.map((hash) => ({ textHash: hash, vector: known.get(hash)! }));
    await embeddings.saveEmbedded(pending, { model: embedder.model, tokens: embedded.tokens, claims: stored, now: clock() });
    log.info(
      apiLogLines.meaning.embedded({
        overviewId: pending.overviewId,
        claims: claims.length,
        embedded: fresh.length,
        reused: claims.length - fresh.length,
        tokens: embedded.tokens,
        model: embedder.model,
      }),
    );
  }

  async #failed(pending: PendingOverview, error: string): Promise<void> {
    const { embeddings, clock, log } = this.#options;
    const attempts = pending.attempts + 1;
    const delay = RETRY_DELAYS_MS[attempts - 1];
    const retrying = attempts < MAX_EMBED_ATTEMPTS && delay !== undefined;
    const now = clock();
    await embeddings.recordFailure(pending, {
      attempts: retrying ? attempts : MAX_EMBED_ATTEMPTS,
      notBefore: retrying ? new Date(now.getTime() + delay) : null,
      error,
      now,
    });
    if (retrying) {
      log.warn(apiLogLines.meaning.embedFailed({ overviewId: pending.overviewId, attempt: attempts, error }));
      setTimeout(() => this.kick(), delay).unref();
    } else {
      log.error(apiLogLines.meaning.embedGaveUp({ overviewId: pending.overviewId, reason: "attempts", error }));
    }
  }
}
