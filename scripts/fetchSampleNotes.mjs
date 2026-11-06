import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES_URL = "https://theoverviewapp.com/api/samples";
const DESTINATION = "packages/app-core/playwright/store/sampleNotes.json";

// The store's screenshots are taken of the house account's samples, so their content is
// whatever Start is offering today (docs/architecture/store-listing.md, "The screenshots").
// A sample whose share has gone is left out of the answer by the API, not nulled, so the only
// thing to check is that something came back at all.
export function notesFrom(answer) {
  const samples = answer?.samples;
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error(`${SAMPLES_URL} listed no samples, so there is nothing to take shots of`);
  }
  const notes = samples.map(({ note }) => note);
  const untitled = notes.filter((note) => typeof note?.source?.title !== "string");
  if (untitled.length > 0) throw new Error(`${untitled.length} of ${notes.length} samples carry no title`);
  return notes;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const response = await fetch(SAMPLES_URL);
    if (!response.ok) throw new Error(`${SAMPLES_URL} answered ${response.status}`);
    const notes = notesFrom(await response.json());
    writeFileSync(path.join(rootDir, DESTINATION), `${JSON.stringify(notes, null, 2)}\n`);
    console.log(`${notes.length} samples written to ${DESTINATION}; now run task store:screenshots`);
    for (const note of notes) console.log(`  ${note.source.title}`);
  } catch (error) {
    console.error(`samples: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
