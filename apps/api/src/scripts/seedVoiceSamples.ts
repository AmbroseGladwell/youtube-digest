import pg from "pg";
import { NarrationVoice, apiLogLines } from "@overview/domain";
import { AudioRenderQueue } from "../audio/AudioRenderQueue.js";
import { AudioRendersRepository } from "../audio/AudioRendersRepository.js";
import { createAudioSetup } from "../audio/createAudioSetup.js";
import { seedVoiceSamples } from "../audio/seedVoiceSamples.js";
import { VoiceSamplesRepository } from "../audio/VoiceSamplesRepository.js";
import { createPgSqlClient } from "../db/createPgSqlClient.js";
import { migrationSteps } from "../db/migrationSteps.js";
import { runMigrations } from "../db/runMigrations.js";
import { ConfigError, loadConfig } from "../loadConfig.js";

// Fly's release_command, run before the new machines start: why it migrates, renders in the
// deploy and never fails it is in docs/features/narration-voice.md, "The samples".
const log = (line: object) => console.log(JSON.stringify(line));

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof ConfigError ? `configuration: ${error.message}` : error);
  process.exit(1);
}

const sql = createPgSqlClient(new pg.Pool({ connectionString: config.databaseUrl }));
const applied = await runMigrations(sql, { before: migrationSteps() });
log(apiLogLines.startup.migrationsApplied({ applied }));

if (config.audio === null) {
  log(apiLogLines.seed.narrationUnavailable({ why: "TTS_URL is not set" }));
} else {
  const setup = createAudioSetup(config.audio, false);
  const renders = new AudioRendersRepository(sql);
  const samples = new VoiceSamplesRepository(sql);
  const seeded = await seedVoiceSamples({ renders, samples, store: setup.store, now: new Date() });
  log(apiLogLines.seed.voiceSamplesSeeded(seeded));

  const queue = new AudioRenderQueue({
    renders,
    clock: () => new Date(),
    log: { info: log, warn: log, error: log },
    ...setup,
  });
  await Promise.all(Array.from({ length: setup.concurrency }, () => queue.drain()));

  const ready = (await samples.ready()).map((sample) => sample.voice);
  const missing = NarrationVoice.options.filter((voice) => !ready.includes(voice));
  log(apiLogLines.seed.voiceSamplesReady({ ready: ready.length, of: NarrationVoice.options.length, missing }));
}
await sql.close();
