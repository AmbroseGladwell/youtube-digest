import test from "node:test";
import assert from "node:assert/strict";
import { Response } from "undici";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import type { PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { createTikTokReader } from "./createTikTokReader.js";
import { CAPTIONS_URL, CAPTIONS_VTT, makeTikTokItem, makeTikTokPage, pageWithItem, VIDEO_ID } from "./TikTokPageFactory.testHelper.js";

type Answer = { body: string; url?: string } | "missing" | "blocked" | "down";

const PAGE = `https://www.tiktok.com/@/video/${VIDEO_ID}`;
const NOW = new Date("2026-11-22T10:00:00.000Z");

function readerOver(web: Record<string, Answer>) {
  const asked: string[] = [];
  const fetchPublicWeb = async (link: string): Promise<PublicWebAnswer> => {
    asked.push(link);
    const answer = web[link];
    if (answer === undefined || answer === "missing") return { status: "failed", reason: "missing" };
    if (answer === "blocked") return { status: "failed", reason: "blocked" };
    if (answer === "down") return { status: "failed", reason: "no-answer" };
    return { status: "answered", url: answer.url ?? link, response: new Response(answer.body) };
  };
  return { reader: createTikTokReader({ fetchPublicWeb, clock: () => NOW }), asked };
}

const transcriptFailure = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "no failure";
  } catch (error) {
    assert.ok(error instanceof TranscriptFetchError);
    return error.failure;
  }
};

test("a video link is read from the video's own page, whatever handle or parameters it came with", async () => {
  const { reader, asked } = readerOver({ [PAGE]: { body: makeTikTokPage() } });

  const read = await reader.read(`https://www.tiktok.com/@someone/video/${VIDEO_ID}?is_from_webapp=1`);

  assert.equal(read.status, "read");
  assert.equal(read.status === "read" ? read.video.handle : null, "anewsroom");
  assert.deepEqual(asked, [PAGE]);
});

test("a short link is followed to the page it names", async () => {
  const short = "https://vm.tiktok.com/ZMhAbCdEf/";
  const { reader } = readerOver({ [short]: { body: makeTikTokPage(), url: `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}` } });

  const read = await reader.read(short);

  assert.equal(read.status === "read" ? read.video.id : null, VIDEO_ID);
});

test("a link that isn't a TikTok video is refused without a fetch", async () => {
  const { reader, asked } = readerOver({});

  assert.deepEqual(await reader.read("https://www.tiktok.com/@anewsroom"), { status: "failed", reason: "not-a-video" });
  assert.deepEqual(await reader.read("https://example.com/video"), { status: "failed", reason: "not-a-video" });
  assert.deepEqual(asked, []);
});

test("a refused, missing or silent page each say why", async () => {
  assert.deepEqual(await readerOver({ [PAGE]: "blocked" }).reader.read(PAGE), { status: "failed", reason: "blocked" });
  assert.deepEqual(await readerOver({ [PAGE]: "missing" }).reader.read(PAGE), { status: "failed", reason: "unavailable" });
  assert.deepEqual(await readerOver({ [PAGE]: "down" }).reader.read(PAGE), { status: "failed", reason: "no-answer" });
  assert.deepEqual(await readerOver({ [PAGE]: { body: "<html>Verify</html>" } }).reader.read(PAGE), {
    status: "failed",
    reason: "unreadable",
  });
  assert.deepEqual(await readerOver({ [PAGE]: { body: makeTikTokPage({ statusCode: 10204 }) } }).reader.read(PAGE), {
    status: "failed",
    reason: "unavailable",
  });
});

test("a video's words come from its caption track, keyed as a TikTok and marked machine-heard", async () => {
  const { reader } = readerOver({ [PAGE]: { body: makeTikTokPage() }, [CAPTIONS_URL]: { body: CAPTIONS_VTT } });

  const { transcript, source } = await reader.transcript(VIDEO_ID);

  assert.equal(source, "ASR");
  assert.equal(transcript.videoId, `tiktok:${VIDEO_ID}`);
  assert.equal(transcript.generated, true);
  assert.equal(transcript.fetchedAt, NOW.toISOString());
  assert.equal(transcript.segments[0]?.startMs, 0);
  assert.match(transcript.segments.map(({ text }) => text).join(" "), /^There is now a real chance that the talks end/);
});

test("the spoken track is chosen over a translation of it", async () => {
  const translation = "https://captions.tiktok.example/fr.vtt";
  const item = makeTikTokItem(
    {},
    {
      subtitleInfos: [
        { LanguageCodeName: "fra-FR", Source: "MT", Format: "webvtt", Url: translation },
        { LanguageCodeName: "eng-US", Source: "ASR", Format: "webvtt", Url: CAPTIONS_URL },
      ],
    },
  );
  const { reader, asked } = readerOver({ [PAGE]: { body: pageWithItem(item) }, [CAPTIONS_URL]: { body: CAPTIONS_VTT } });

  await reader.transcript(VIDEO_ID);

  assert.deepEqual(asked, [PAGE, CAPTIONS_URL]);
});

test("a video without captions, or with empty ones, has no transcript to give", async () => {
  const bare = readerOver({ [PAGE]: { body: pageWithItem(makeTikTokItem({}, { subtitleInfos: [] })) } });
  assert.equal(await transcriptFailure(bare.reader.transcript(VIDEO_ID)), TranscriptFetchFailure.NO_CAPTIONS);

  const empty = readerOver({ [PAGE]: { body: makeTikTokPage() }, [CAPTIONS_URL]: { body: "WEBVTT\n\n" } });
  assert.equal(await transcriptFailure(empty.reader.transcript(VIDEO_ID)), TranscriptFetchFailure.NO_CAPTIONS);
});

test("a transcript that can't be fetched says why in transcript terms", async () => {
  assert.equal(
    await transcriptFailure(readerOver({ [PAGE]: "blocked" }).reader.transcript(VIDEO_ID)),
    TranscriptFetchFailure.SOURCE_BLOCKED,
  );
  assert.equal(
    await transcriptFailure(readerOver({ [PAGE]: { body: makeTikTokPage({ statusCode: 10204 }) } }).reader.transcript(VIDEO_ID)),
    TranscriptFetchFailure.VIDEO_UNAVAILABLE,
  );
  assert.equal(
    await transcriptFailure(readerOver({ [PAGE]: { body: makeTikTokPage() }, [CAPTIONS_URL]: "down" }).reader.transcript(VIDEO_ID)),
    TranscriptFetchFailure.SOURCE_UNAVAILABLE,
  );
});
