import test from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { PlaylistId } from "@overview/domain";
import { FAKE_API_KEY, makeFakeYouTubeDataApi, type FakePlaylist } from "./FakeYouTubeDataApi.testHelper.js";
import { PlaylistUnavailableError } from "./PlaylistReader.js";
import { youTubeDataApiPlaylistReader } from "./youTubeDataApiPlaylistReader.js";

const silent = pino({ level: "silent" });

const psychology: FakePlaylist = {
  id: "PLpsychology",
  title: "Psychology",
  channelTitle: "Veritasium",
  privacyStatus: "public",
  items: [
    { videoId: "k3Gw0Nhk2Ls", title: "Why We Can't Remember Being Babies", addedAt: "2026-09-01T09:00:00Z" },
    { videoId: "priv0000001", title: "Private video", privacyStatus: "private" },
    { videoId: "gone0000001", title: "Deleted video", privacyStatus: "privacyStatusUnspecified" },
  ],
};

const reader = (playlists: FakePlaylist[]) => {
  const fake = makeFakeYouTubeDataApi(playlists);
  return { fake, reader: youTubeDataApiPlaylistReader({ apiKey: FAKE_API_KEY, youTubeFetch: fake.youTubeFetch }) };
};

test("a public playlist reads whole: its title, owner, privacy and every entry in order", async () => {
  const { reader: read } = reader([psychology]);

  const lookup = await read.read(PlaylistId.parse("PLpsychology"), silent);

  assert.equal(lookup.title, "Psychology");
  assert.equal(lookup.owner, "Veritasium");
  assert.equal(lookup.privacy, "public");
  assert.deepEqual(lookup.entries[0], {
    videoId: "k3Gw0Nhk2Ls",
    title: "Why We Can't Remember Being Babies",
    channel: "Veritasium",
    thumbnailUrl: "https://i.ytimg.com/vi/k3Gw0Nhk2Ls/mqdefault.jpg",
    addedAt: "2026-09-01T09:00:00.000Z",
    availability: "available",
  });
});

test("a private or deleted video stays listed, marked as such, with no thumbnail", async () => {
  const { reader: read } = reader([psychology]);

  const { entries } = await read.read(PlaylistId.parse("PLpsychology"), silent);

  assert.deepEqual(
    entries.slice(1).map(({ videoId, availability, thumbnailUrl }) => ({ videoId, availability, thumbnailUrl })),
    [
      { videoId: "priv0000001", availability: "private", thumbnailUrl: null },
      { videoId: "gone0000001", availability: "deleted", thumbnailUrl: null },
    ],
  );
});

test("a playlist longer than one page is read page by page until YouTube stops offering another", async () => {
  const items = Array.from({ length: 123 }, (_, index) => ({ videoId: `vid${String(index).padStart(8, "0")}`, title: `Lecture ${index}` }));
  const { fake, reader: read } = reader([{ ...psychology, id: "PLlectures", items }]);

  const { entries } = await read.read(PlaylistId.parse("PLlectures"), silent);

  assert.equal(entries.length, 123);
  assert.equal(entries.at(-1)!.title, "Lecture 122");
  assert.equal(fake.requests.filter((request) => request.url.includes("/playlistItems")).length, 3);
});

test("an unlisted playlist says so", async () => {
  const { reader: read } = reader([{ ...psychology, id: "PLunlisted", privacyStatus: "unlisted" }]);
  assert.equal((await read.read(PlaylistId.parse("PLunlisted"), silent)).privacy, "unlisted");
});

test("a private playlist is told apart from a missing one", async () => {
  const { reader: read } = reader([{ ...psychology, id: "PLprivate", privacyStatus: "private" }]);

  await assert.rejects(read.read(PlaylistId.parse("PLprivate"), silent), (error) => error instanceof PlaylistUnavailableError && error.reason === "private");
  await assert.rejects(read.read(PlaylistId.parse("PLmissing"), silent), (error) => error instanceof PlaylistUnavailableError && error.reason === "gone");
});

test("the quota a read spent is logged: one unit for the playlist and one for each page", async () => {
  const lines: Array<Record<string, unknown>> = [];
  const log = pino({ level: "info" }, { write: (line: string) => lines.push(JSON.parse(line)) });
  const { reader: read } = reader([psychology]);

  await read.read(PlaylistId.parse("PLpsychology"), log);

  const [line] = lines.filter((entry) => entry.msg === "playlist read");
  assert.equal(line?.units, 2);
  assert.equal(line?.entries, 3);
});

test("the API key goes in a header on every Data API call, never in a URL, and never to oEmbed", async () => {
  const { fake, reader: read } = reader([psychology]);
  await read.read(PlaylistId.parse("PLpsychology"), silent);
  await assert.rejects(read.read(PlaylistId.parse("PLmissing"), silent));

  const dataApi = fake.requests.filter((request) => request.url.startsWith("https://www.googleapis.com/"));
  const oEmbed = fake.requests.filter((request) => request.url.includes("/oembed"));
  assert.ok(dataApi.length > 0 && oEmbed.length > 0);
  assert.ok(dataApi.every((request) => request.headers["x-goog-api-key"] === FAKE_API_KEY));
  assert.ok(fake.requests.every((request) => !request.url.includes(FAKE_API_KEY)));
  assert.ok(oEmbed.every((request) => request.headers["x-goog-api-key"] === undefined));
});
