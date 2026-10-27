import test from "node:test";
import assert from "node:assert/strict";
import { FollowedPlaylist } from "./FollowedPlaylist.js";
import { CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION, FOLLOWED_PLAYLIST_MIGRATIONS } from "./followedPlaylistMigrations.js";
import { migrateRecord } from "./migrateRecord.js";
import { storedSchemaVersion } from "./storedSchemaVersion.js";

const followedBeforePaces = {
  id: "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  followedAt: "2026-10-05T09:00:00.000Z",
  unavailable: null,
};

const migrate = (record: unknown) => migrateRecord(record, FOLLOWED_PLAYLIST_MIGRATIONS);

test("a playlist followed before there were paces keeps being made as its videos come", () => {
  assert.equal((migrate(followedBeforePaces) as Record<string, unknown>).pace, "asTheyCome");
});

test("the rest of the record is carried through untouched", () => {
  assert.deepEqual(
    { ...(migrate(followedBeforePaces) as Record<string, unknown>), schemaVersion: undefined, pace: undefined },
    { ...followedBeforePaces, schemaVersion: undefined, pace: undefined },
  );
});

test("a migrated record is stamped with the current version and parses, which is what the read boundary does next", () => {
  const migrated = migrate(followedBeforePaces);

  assert.equal(storedSchemaVersion(migrated), CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION);
  assert.equal(FollowedPlaylist.parse(migrated).pace, "asTheyCome");
});

test("a record already at the current version keeps the pace it was given", () => {
  const current = { ...followedBeforePaces, pace: "oneADay", schemaVersion: CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION };

  assert.equal(FollowedPlaylist.parse(migrate(current)).pace, "oneADay");
});
