import type { FastifyInstance } from "fastify";
import { DEFAULT_SETTINGS, SectionsEnabled, Settings, mergeSettingsRecord } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { ifMatchOf, sendWritten, UpdatedAt } from "../http/writeHeaders.js";
import { decideMerge } from "../records/decideMerge.js";
import { SETTINGS_RECORD_ID } from "../records/RecordKind.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import { milestoneChanges } from "./milestoneChanges.js";

const SettingsPatch = Settings.partial()
  .extend({ sectionsEnabled: SectionsEnabled.partial().optional(), updatedAt: UpdatedAt })
  .strict();

export function settingsRoutes(app: FastifyInstance, records: RecordsRepository): void {
  app.put("/settings", async (request, reply) => {
    const { updatedAt, ...patch } = parseOrThrow(SettingsPatch, request.body, "The settings patch");
    if (Object.keys(patch).length === 0) {
      throw new ApiError("invalid_request", "The settings patch changes nothing");
    }
    if (patch.analyticsOptOut !== undefined) {
      request.log.info({ analyticsOptOut: patch.analyticsOptOut }, "analytics opt-out set");
    }
    if (patch.narrationVoice !== undefined) {
      request.log.info({ narrationVoice: patch.narrationVoice }, "narration voice chosen");
    }
    const ifMatch = ifMatchOf(request);
    const [written] = await records.write(request.session!.accountId, [
      {
        kind: "settings",
        id: SETTINGS_RECORD_ID,
        decide: (current) => {
          const decision = decideMerge(
            "settings",
            current,
            { patch, updatedAt, ifMatch, defaults: { ...DEFAULT_SETTINGS }, merge: mergeSettingsRecord },
            request.client!,
          );
          if (patch.milestones !== undefined) {
            const changes = milestoneChanges(current?.deleted ? null : current?.body?.milestones, patch.milestones);
            if (Object.keys(changes).length > 0) {
              request.log.info({ milestones: changes }, "time-saved milestones changed");
            }
          }
          return decision;
        },
      },
    ]);
    return sendWritten(reply, written!);
  });
}
