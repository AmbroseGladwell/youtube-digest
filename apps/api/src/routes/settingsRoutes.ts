import type { FastifyInstance } from "fastify";
import { DEFAULT_SETTINGS, SectionsEnabled, Settings } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { ifMatchOf, sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import { SETTINGS_RECORD_ID } from "../records/RecordKind.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";

const SettingsPatch = Settings.partial()
  .extend({ sectionsEnabled: SectionsEnabled.partial().optional(), updatedAt: UpdatedAt })
  .strict();

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// sectionsEnabled merges one level deep, as the local store does, so a patch to one
// toggle does not take a newer client's toggles with it (docs/features/record-migrations.md).
const mergeSettings = (base: Record<string, unknown>, patch: Record<string, unknown>) => ({
  ...base,
  ...patch,
  ...(isObject(patch.sectionsEnabled)
    ? { sectionsEnabled: { ...(isObject(base.sectionsEnabled) ? base.sectionsEnabled : {}), ...patch.sectionsEnabled } }
    : {}),
});

export function settingsRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.put("/settings", async (request, reply) => {
    const { updatedAt, ...patch } = parseOrThrow(SettingsPatch, request.body, "The settings patch");
    if (Object.keys(patch).length === 0) {
      throw new ApiError("invalid_request", "The settings patch changes nothing");
    }
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "settings",
        id: SETTINGS_RECORD_ID,
        decide: (current) =>
          decideMerge(
            "settings",
            current,
            { patch, updatedAt, ifMatch, defaults: { ...DEFAULT_SETTINGS }, merge: mergeSettings },
            request.client!,
          ),
      },
    ]);
    return sendWritten(reply, written!);
  });
}
