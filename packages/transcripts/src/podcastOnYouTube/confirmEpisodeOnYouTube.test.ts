import test from "node:test";
import assert from "node:assert/strict";
import { confirmEpisodeOnYouTube } from "./confirmEpisodeOnYouTube.js";
import type { EpisodeToFind } from "./matchUpload.js";
import { episodeKeywords } from "./noteWords.js";

const NOW = new Date("2026-11-13T12:00:00.000Z");
const NOTES =
  "Anthony Scaramucci and Katty Kay discuss the departure of Susie Wiles, Stephen Miller's promotion, the shutdown talks and Mamdani.";
const episode: EpisodeToFind = {
  showName: "The Rest Is Politics: US",
  title: "241. Susie Wiles Out, Stephen Miller In: What Happens Now?",
  durationSeconds: 2184,
  publishedAt: "2026-11-10T06:00:00.000Z",
  keywords: episodeKeywords(NOTES, []),
};

const playerOf = (video: { videoId?: string; title: string; lengthSeconds: string; description: string; published: string }) => {
  let requests = 0;
  const youTubeFetch = async () => {
    requests += 1;
    return {
      status: 200,
      body: JSON.stringify({
        playabilityStatus: { status: "UNPLAYABLE" },
        videoDetails: {
          videoId: video.videoId ?? "v1",
          title: video.title,
          lengthSeconds: video.lengthSeconds,
          shortDescription: video.description,
        },
        microformat: { playerMicroformatRenderer: { publishDate: video.published } },
      }),
    };
  };
  return { youTubeFetch, requests: () => requests };
};

const confirm = (youTubeFetch: Parameters<typeof confirmEpisodeOnYouTube>[0], videoId = "v1") =>
  confirmEpisodeOnYouTube(youTubeFetch, episode, videoId, { now: () => NOW });

test("a claimed video with the episode's title and length is confirmed, from one request", async () => {
  const youTube = playerOf({
    title: "Susie Wiles Out, Stephen Miller In: What Happens Now? | TRIP US",
    lengthSeconds: "2160",
    description: "",
    published: "2026-11-10",
  });
  assert.equal(await confirm(youTube.youTubeFetch), "title");
  assert.equal(youTube.requests(), 1);
});

test("a retitled video is confirmed by its description, its exact date and a length within 3%", async () => {
  const retitled = {
    title: "It's Official: Trump's Grift IS OUT OF CONTROL",
    lengthSeconds: "2170",
    description: NOTES,
    published: "2026-11-10T03:00:00-08:00",
  };
  assert.equal(await confirm(playerOf(retitled).youTubeFetch), "description");
  assert.equal(await confirm(playerOf({ ...retitled, published: "2026-11-01T03:00:00-08:00" }).youTubeFetch), null);
  assert.equal(await confirm(playerOf({ ...retitled, lengthSeconds: "2400" }).youTubeFetch), null);
  assert.equal(await confirm(playerOf({ ...retitled, description: "A different conversation entirely." }).youTubeFetch), null);
});

test("a clip, or a video that isn't the one claimed, is not the episode", async () => {
  const clip = {
    title: "Susie Wiles Out, Stephen Miller In: What Happens Now?",
    lengthSeconds: "480",
    description: NOTES,
    published: "2026-11-10",
  };
  assert.equal(await confirm(playerOf(clip).youTubeFetch), null);
  assert.equal(await confirm(playerOf({ ...clip, lengthSeconds: "2184", videoId: "another" }).youTubeFetch, "v1"), null);
});

test("YouTube refusing the request is the named failure, not a quiet no", async () => {
  await assert.rejects(
    confirm(async () => ({ status: 429, body: "" })),
    { failure: "rate-limited" },
  );
});

test("the next part of a series isn't the episode, though every other word of its title matches", async () => {
  const partTwo = { ...episode, title: "Closing Up for the Season, Part 2", durationSeconds: 1500 };
  const partOne = playerOf({ title: "Closing Up for the Season, Part 1", lengthSeconds: "1480", description: "", published: "2026-11-10" });
  assert.equal(await confirmEpisodeOnYouTube(partOne.youTubeFetch, partTwo, "v1", { now: () => NOW }), null);
  const numberDropped = playerOf({
    title: "Closing Up for the Season, Part",
    lengthSeconds: "1480",
    description: "",
    published: "2026-11-10",
  });
  assert.equal(
    await confirmEpisodeOnYouTube(numberDropped.youTubeFetch, { ...partTwo, title: "12. Closing Up for the Season" }, "v1", {
      now: () => NOW,
    }),
    "title",
  );
});
