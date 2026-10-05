import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { FAKE_API_KEY, makeFakeYouTubeDataApi } from "../playlists/FakeYouTubeDataApi.testHelper.js";
import { youTubeDataApiPlaylistReader } from "../playlists/youTubeDataApiPlaylistReader.js";

const HEADERS = { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) };

const playlistApp = () => {
  const fake = makeFakeYouTubeDataApi([
    { id: "PLpsychology", title: "Psychology", channelTitle: "Veritasium", privacyStatus: "public", items: [{ videoId: "k3Gw0Nhk2Ls", title: "Why We Can't Remember Being Babies" }] },
    { id: "PLprivate", title: "Mine", channelTitle: "Me", privacyStatus: "private", items: [] },
  ]);
  return createTestApp({}, { playlistReader: youTubeDataApiPlaylistReader({ apiKey: FAKE_API_KEY, youTubeFetch: fake.youTubeFetch }) });
};

test("anyone can look a playlist up, without signing in", async () => {
  const testApp = await playlistApp();

  const response = await testApp.app.inject({ method: "GET", url: "/api/playlists/PLpsychology", headers: HEADERS });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().title, "Psychology");
  assert.equal(response.json().entries.length, 1);
  await testApp.close();
});

test("a private playlist and a missing one are refused with codes the reader can be told about", async () => {
  const testApp = await playlistApp();

  const [privateOne, missing] = await Promise.all([
    testApp.app.inject({ method: "GET", url: "/api/playlists/PLprivate", headers: HEADERS }),
    testApp.app.inject({ method: "GET", url: "/api/playlists/PLmissing", headers: HEADERS }),
  ]);

  assert.equal(privateOne.statusCode, 422);
  assert.equal(privateOne.json().error.code, "playlist_private");
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "playlist_not_found");
  await testApp.close();
});

test("a server without a YouTube key says playlists are unavailable rather than failing", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({ method: "GET", url: "/api/playlists/PLpsychology", headers: HEADERS });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "unavailable");
  await testApp.close();
});

test("one address can look up a bounded number of playlists an hour", async () => {
  const testApp = await playlistApp();
  const ask = () =>
    testApp.app.inject({ method: "GET", url: "/api/playlists/PLpsychology", headers: HEADERS, remoteAddress: "203.0.113.9" });

  for (let index = 0; index < 120; index += 1) await ask();
  const refused = await ask();

  assert.equal(refused.statusCode, 429);
  await testApp.close();
});
