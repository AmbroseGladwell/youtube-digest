import { z } from "zod";
import {
  aboutYouSentence,
  DEFAULT_SETTINGS,
  noticedLearnedItems,
  readStoredRecord,
  SETTINGS_MIGRATIONS,
  Settings,
  stampSchemaVersion,
} from "@overview/domain";
import { SETTINGS_RECORD_ID } from "../records/RecordKind.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { AccountId } from "../auth/AccountId.js";
import { mcpTool, toolError } from "./McpTool.js";

export const SHARING_OFF =
  "The reader has turned off sharing what The Overview knows about them with assistants. They can turn it back on in Settings › Personalisation.";
export const NOTHING_KNOWN =
  "The Overview knows nothing about this reader yet: they haven't written an About you sentence, and nothing has been learned from their overviews. Don't guess at one.";

async function readSettings(records: RecordsRepository, accountId: AccountId): Promise<Settings | null> {
  const stored = await records.read(accountId, "settings", SETTINGS_RECORD_ID);
  if (stored === null || stored.deleted || stored.body === null) {
    return DEFAULT_SETTINGS;
  }
  const read = readStoredRecord(stampSchemaVersion(stored.body, stored.schemaVersion), Settings, SETTINGS_MIGRATIONS);
  return read.status === "read" ? read.record : null;
}

// What the reader wrote and what the profile pass learned, each learned item with what it rests
// on. An item the reader hasn't been shown yet, or removed, is never handed over: nothing joins
// what an assistant sees unseen (docs/features/mcp-connector.md, "The profile").
export const getProfile = mcpTool({
  name: "get_profile",
  title: "Read what is known about the reader",
  description:
    "Read what The Overview knows about the reader: the About you sentence they wrote, and what it has learned from the overviews they save, each with what it rests on. Use it to fit answers to them. It is theirs to change, so say where a claim about them came from.",
  input: z.object({}),
  readsProfile: true,
  run: async (_input, { records, accountId }) => {
    const settings = await readSettings(records, accountId);
    if (settings === null) {
      return toolError("What is known about the reader couldn't be read by this server. Try again shortly.");
    }
    if (!settings.shareProfileWithAssistants) {
      return toolError(SHARING_OFF);
    }
    const sentence = aboutYouSentence(settings.aboutYou);
    const learned = noticedLearnedItems(settings.learned);
    if (sentence === "" && learned.length === 0) {
      return { text: NOTHING_KNOWN };
    }
    return {
      text: [
        "What The Overview knows about the reader. They can see, change and remove all of it in Settings › Personalisation.",
        ...(sentence === "" ? [] : ["", "In their own words:", `"${sentence}"`]),
        ...(learned.length === 0
          ? []
          : ["", "Learned from the overviews they save:", ...learned.map(({ text, source }) => `- ${text} (${source})`)]),
      ].join("\n"),
    };
  },
});
