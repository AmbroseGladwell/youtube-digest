import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { comparisonPaths } from "../comparisonPaths.js";
import { chatReportMarkdown } from "../chat/chatReportMarkdown.js";
import type { ChatConversationRecord } from "../chat/runChatConversation.js";

const { values } = parseArgs({ options: { run: { type: "string" } } });
if (values.run === undefined) {
  console.error("usage: npm run chat-report --workspace packages/model-comparison -- --run <name>");
  process.exit(1);
}
const directory = join(comparisonPaths.chat, "runs", values.run);
const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
const records = await Promise.all(
  files.map(async (file) => JSON.parse(await readFile(join(directory, file), "utf-8")) as ChatConversationRecord),
);
const markdown = chatReportMarkdown(records);
await writeFile(join(comparisonPaths.chat, `${values.run}.md`), markdown);
console.log(markdown);
