import { describe, expect, it } from "vitest";
import { PlaylistId, VideoId, type PlaylistPace, type QueuedCapture } from "@overview/domain";
import { makeQueuedCapture } from "../../playlists/types/PlaylistFactory.testHelper.js";
import { pacedQueue } from "./pacedQueue.js";

const PSYCHOLOGY = { id: PlaylistId.parse("PLpsychology"), title: "Psychology" };
const LECTURES = { id: PlaylistId.parse("PLlectures"), title: "Every Lecture" };
const SAVED = { id: PlaylistId.parse("PLsaved"), title: "Saved for later" };

const from = (fromPlaylist: typeof PSYCHOLOGY, count: number, start: number, overrides: Partial<QueuedCapture> = {}) =>
  Array.from({ length: count }, (_, index) =>
    makeQueuedCapture({
      videoId: VideoId.parse(`${fromPlaylist.id.slice(2, 6)}video${String(start + index).padStart(2, "0")}`),
      fromPlaylist,
      queuedAt: new Date(Date.UTC(2026, 9, 26, 9, 0, 0, start + index)).toISOString(),
      ...overrides,
    }),
  );

const paces = (byPlaylist: Record<string, PlaylistPace>) => (capture: QueuedCapture) =>
  byPlaylist[capture.fromPlaylist.id] ?? "asTheyCome";
const made = (byPlaylist: Record<string, number>) => (capture: QueuedCapture) => byPlaylist[capture.fromPlaylist.id] ?? 0;
const ids = (captures: QueuedCapture[]) => captures.map((capture) => capture.videoId);

describe("pacedQueue", () => {
  it("makes everything from a playlist that has no pace, in the order it waits", () => {
    const waiting = from(PSYCHOLOGY, 12, 0);

    const paced = pacedQueue(waiting, paces({}), made({}));

    expect(ids(paced.ready)).toEqual(ids(waiting));
    expect(paced.tomorrow).toEqual([]);
  });

  it("makes a paced playlist's oldest up to its number and keeps the rest for tomorrow", () => {
    const waiting = from(PSYCHOLOGY, 12, 0);

    const paced = pacedQueue(waiting, paces({ PLpsychology: "fiveADay" }), made({}));

    expect(ids(paced.ready)).toEqual(ids(waiting.slice(0, 5)));
    expect(ids(paced.tomorrow)).toEqual(ids(waiting.slice(5)));
  });

  it("takes what the playlist has already made today off its number", () => {
    const waiting = from(PSYCHOLOGY, 7, 0);

    const paced = pacedQueue(waiting, paces({ PLpsychology: "fiveADay" }), made({ PLpsychology: 3 }));

    expect(paced.ready).toHaveLength(2);
    expect(paced.tomorrow).toHaveLength(5);
  });

  it("holds only its own playlist: the rest of the queue keeps its place", () => {
    const lectures = from(LECTURES, 3, 0);
    const psychology = from(PSYCHOLOGY, 3, 10);

    const paced = pacedQueue([...lectures, ...psychology], paces({ PLlectures: "oneADay" }), made({ PLlectures: 1 }));

    expect(ids(paced.ready)).toEqual(ids(psychology));
    expect(ids(paced.tomorrow)).toEqual(ids(lectures));
  });

  it("waits for the reader on a playlist made only when they choose, without using its number", () => {
    const waiting = from(SAVED, 4, 0);

    const paced = pacedQueue(waiting, paces({ PLsaved: "whenChosen" }), made({}));

    expect(paced.ready).toEqual([]);
    expect(ids(paced.forYou)).toEqual(ids(waiting));
  });

  it("puts a video the reader chose first, past its pace, and leaves the pace's own number alone", () => {
    const waiting = from(PSYCHOLOGY, 8, 0);
    const chosenLast = { ...waiting[7]!, chosenAt: "2026-10-26T12:00:00.000Z" };

    const paced = pacedQueue([...waiting.slice(0, 7), chosenLast], paces({ PLpsychology: "fiveADay" }), made({ PLpsychology: 5 }));

    expect(ids(paced.ready)).toEqual([chosenLast.videoId]);
    expect(paced.tomorrow).toHaveLength(7);
  });

  it("makes chosen videos from a when-I-choose playlist, oldest first, ahead of everything else", () => {
    const saved = from(SAVED, 3, 0);
    const chosen = [saved[2]!, saved[0]!].map((capture) => ({ ...capture, chosenAt: "2026-10-26T12:00:00.000Z" }));
    const others = from(PSYCHOLOGY, 2, 10);

    const paced = pacedQueue([chosen[1]!, saved[1]!, chosen[0]!, ...others], paces({ PLsaved: "whenChosen" }), made({}));

    expect(ids(paced.ready)).toEqual([saved[0]!.videoId, saved[2]!.videoId, ...ids(others)]);
    expect(ids(paced.forYou)).toEqual([saved[1]!.videoId]);
  });
});
