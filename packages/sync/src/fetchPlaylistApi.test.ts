import test from "node:test";
import assert from "node:assert/strict";
import { PlaylistId, VideoId, type PlaylistLookup } from "@overview/domain";
import { createFetchPlaylistApi } from "./fetchPlaylistApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

const answering = (status: number, body: unknown) => {
  const sent: string[] = [];
  const fetch = async (input: string | URL | Request): Promise<Response> => {
    sent.push(String(input));
    return new Response(JSON.stringify(body), { status });
  };
  return { sent, fetch };
};

const lookup: PlaylistLookup = {
  id: PlaylistId.parse("PLpsychology"),
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  entries: [
    {
      videoId: VideoId.parse("k3Gw0Nhk2Ls"),
      title: "Why We Can't Remember Being Babies",
      channel: "Veritasium",
      thumbnailUrl: null,
      addedAt: "2026-09-01T09:00:00.000Z",
      availability: "available",
    },
  ],
};

test("a playlist is looked up by its id", async () => {
  const { sent, fetch } = answering(200, lookup);
  const api = createFetchPlaylistApi({ baseUrl: "https://overview.example", fetch });

  assert.deepEqual(await api.lookup(lookup.id), lookup);
  assert.deepEqual(sent, ["https://overview.example/api/playlists/PLpsychology"]);
});

test("a private playlist is refused with its own code, so the reader can be told what to do", async () => {
  const { fetch } = answering(422, { error: { code: "playlist_private", message: "That playlist is private" } });
  const api = createFetchPlaylistApi({ baseUrl: "https://overview.example", fetch });

  await assert.rejects(api.lookup(PlaylistId.parse("PLprivate")), (error) => isSyncRequestError(error) && error.code === "playlist_private");
});
