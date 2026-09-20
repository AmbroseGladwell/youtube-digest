import test from "node:test";
import assert from "node:assert/strict";
import { TranscriptFetchError } from "../TranscriptFetchError.js";
import { mapPlayerResponseToVideoSource } from "./mapPlayerResponseToVideoSource.js";
import { makeMetadataResponse, makePlayerResponse } from "./PlayerResponseFactory.testHelper.js";

const URL = "https://www.youtube.com/watch?v=tL9Lw250spc&t=30";

test("the video's own fields map across, and the url is the caller's rather than the payload's", () => {
  const video = mapPlayerResponseToVideoSource(makePlayerResponse(), URL);

  assert.equal(video.id, "tL9Lw250spc");
  assert.equal(video.url, URL);
  assert.equal(video.channel, "Veritasium");
  assert.equal(video.durationMs, 2132000);
});

test("duration is the video's own length, not the end of its captions", () => {
  const video = mapPlayerResponseToVideoSource(makePlayerResponse(), URL);

  // The last written caption of this video ends at 2127200ms, which is what a
  // caption-derived duration would report (docs/features/transcript-retrieval.md).
  assert.notEqual(video.durationMs, 2127200);
  assert.equal(video.durationMs, 2132000);
});

test("a live stream has no duration rather than a duration of zero", () => {
  const response = makePlayerResponse();
  response.videoDetails!.lengthSeconds = "0";

  assert.equal(mapPlayerResponseToVideoSource(response, URL).durationMs, null);
});

test("the widest thumbnail YouTube offered is taken, never one assembled from the id", () => {
  const video = mapPlayerResponseToVideoSource(makePlayerResponse(), URL);

  assert.equal(video.thumbnailUrl, "https://i.ytimg.com/vi_webp/tL9Lw250spc/sddefault.webp");
});

test("the publish date comes from the client that carries one, and is normalised to an instant", () => {
  const video = mapPlayerResponseToVideoSource(makePlayerResponse(), URL, makeMetadataResponse());

  assert.equal(video.publishedAt, "2026-07-25T17:29:09.000Z");
});

test("no metadata response means no publish date, rather than a guessed one", () => {
  assert.equal(mapPlayerResponseToVideoSource(makePlayerResponse(), URL).publishedAt, null);
});

test("a missing title degrades to a word rather than failing the whole mapping", () => {
  const response = makePlayerResponse();
  delete response.videoDetails!.title;

  assert.equal(mapPlayerResponseToVideoSource(response, URL).title, "unavailable");
});

test("a description is cut to what VideoSource will hold", () => {
  const response = makePlayerResponse();
  response.videoDetails!.shortDescription = "x".repeat(900);

  assert.equal(mapPlayerResponseToVideoSource(response, URL).description?.length, 400);
});

test("a response with no video id is malformed, because nothing can be filed under it", () => {
  const response = makePlayerResponse();
  delete response.videoDetails!.videoId;

  assert.throws(
    () => mapPlayerResponseToVideoSource(response, URL),
    (error: unknown) => {
      assert.ok(error instanceof TranscriptFetchError);
      assert.equal(error.failure, "malformed-response");
      return true;
    },
  );
});
