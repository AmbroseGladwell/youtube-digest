import type { PersonEraser } from "./PersonEraser.js";

export interface PostHogErasureOptions {
  personalApiKey: string;
  projectId: string;
  // The project's own host (eu.posthog.com), not the ingestion host events go to.
  host: string;
  fetch?: typeof fetch | undefined;
  timeoutMs?: number;
}

export class PostHogErasureError extends Error {}

interface PersonsPage {
  results?: Array<{ id: string }>;
}

// The person is looked up by the distinct id we sent events under, then deleted with its
// events. Deleting is asynchronous on PostHog's side, so a 204 means queued
// (docs/features/account-deletion.md, "Erasure at PostHog").
export function createPostHogPersonEraser({
  personalApiKey,
  projectId,
  host,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
}: PostHogErasureOptions): PersonEraser {
  const base = `${host.replace(/\/+$/, "")}/api/projects/${encodeURIComponent(projectId)}/persons/`;
  const headers = { authorization: `Bearer ${personalApiKey}`, accept: "application/json" };
  return {
    erase: async (distinctId) => {
      const found = await fetchImpl(`${base}?distinct_id=${encodeURIComponent(distinctId)}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!found.ok) {
        throw new PostHogErasureError(`PostHog answered ${found.status} looking the person up`);
      }
      const persons = ((await found.json()) as PersonsPage).results ?? [];
      if (persons.length === 0) {
        return "absent";
      }
      for (const person of persons) {
        const deleted = await fetchImpl(`${base}${encodeURIComponent(person.id)}/?delete_events=true`, {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!deleted.ok && deleted.status !== 404) {
          throw new PostHogErasureError(`PostHog answered ${deleted.status} deleting the person`);
        }
      }
      return "queued";
    },
  };
}
