import Anthropic from "@anthropic-ai/sdk";
import {
  OVERVIEW_MIGRATIONS,
  Overview,
  TagAliases,
  readStoredRecord,
  stampSchemaVersion,
  tagUsage,
  type RecordChange,
} from "@overview/domain";
import { createAnthropicGenerationClient, generateTags } from "@overview/generation";
import { createFetchSyncApi, type SyncApi } from "@overview/sync";

// The one-off re-tag of a library made before tags were reused: oldest first, each note
// offered the tags the ones before it ended up with (docs/features/tag-reuse.md).
const USAGE =
  "usage: OVERVIEW_API_URL=<url> OVERVIEW_TOKEN=<session> task secrets:run -- npx tsx scripts/retagLibrary.ts [--write]";

const baseUrl = process.env.OVERVIEW_API_URL;
const token = process.env.OVERVIEW_TOKEN;
const write = process.argv.includes("--write");
if (!baseUrl || !token) {
  console.error(USAGE);
  process.exit(1);
}

async function pullLibrary(api: SyncApi): Promise<{ overviews: Overview[]; aliases: TagAliases }> {
  const latest = new Map<string, RecordChange>();
  let since = 0;
  for (;;) {
    const page = await api.changes(since);
    for (const change of page.changes) latest.set(`${change.kind}:${change.id}`, change);
    since = page.next;
    if (!page.more) break;
  }

  const overviews: Overview[] = [];
  let aliases: TagAliases = {};
  for (const change of latest.values()) {
    if (change.deleted || change.body === undefined) continue;
    if (change.kind === "settings") {
      aliases = TagAliases.catch({}).parse(change.body.tagAliases);
    }
    if (change.kind === "overview") {
      const read = readStoredRecord(stampSchemaVersion(change.body, change.schemaVersion), Overview, OVERVIEW_MIGRATIONS);
      if (read.status === "read") overviews.push(read.record);
      else console.error(`skipped ${change.id}: ${read.detail}`);
    }
  }
  return { overviews: overviews.sort((left, right) => left.savedAt.localeCompare(right.savedAt)), aliases };
}

const api = createFetchSyncApi({ baseUrl, token });
const client = createAnthropicGenerationClient(new Anthropic());
const { overviews, aliases } = await pullLibrary(api);
console.error(`${overviews.length} overviews, ${Object.keys(aliases).length} tag aliases`);

const retaggedSoFar: string[][] = [];
const changed = new Map<string, string[]>();
for (const overview of overviews) {
  const tags = await generateTags(client, { overview, existingTags: tagUsage(retaggedSoFar), tagAliases: aliases });
  retaggedSoFar.push(tags);
  const same = tags.join(",") === overview.tags.join(",");
  console.log(`${same ? "=" : "~"} ${overview.video.title}\n    ${overview.tags.join(", ")}\n  → ${tags.join(", ")}`);
  if (!same) changed.set(overview.id, tags);
}

console.log("\nTags after re-tagging, most used first:");
for (const { tag, count } of tagUsage(retaggedSoFar)) console.log(`  ${tag}: ${count}`);

if (!write) {
  console.error(`\n${changed.size} overviews would change. Nothing written: run again with --write.`);
  process.exit(0);
}

for (const [id, tags] of changed) {
  await api.setOverviewTags(id, tags, new Date().toISOString());
}

const reread = await pullLibrary(api);
const missed = [...changed].filter(
  ([id, tags]) => reread.overviews.find((overview) => overview.id === id)?.tags.join(",") !== tags.join(","),
);
if (missed.length > 0) {
  console.error(`${missed.length} of ${changed.size} overviews did not read back with their new tags: ${missed.map(([id]) => id).join(", ")}`);
  process.exit(1);
}
console.error(`${changed.size} overviews re-tagged, each read back from the server.`);
