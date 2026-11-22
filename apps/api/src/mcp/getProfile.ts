import { z } from "zod";
import { aboutYouSentence, noticedLearnedItems } from "@overview/domain";
import { readSettings } from "../records/readSettings.js";
import { mcpTool, toolError } from "./McpTool.js";

export const SHARING_OFF =
  "The reader has turned off sharing what The Overview knows about them with assistants. They can turn it back on in Settings › Personalisation.";
export const NOTHING_KNOWN =
  "The Overview knows nothing about this reader yet: they haven't written an About you sentence, and nothing has been learned from their overviews. Don't guess at one.";

// Unseen or removed items are never handed over: docs/features/mcp-connector.md, "The profile".
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
