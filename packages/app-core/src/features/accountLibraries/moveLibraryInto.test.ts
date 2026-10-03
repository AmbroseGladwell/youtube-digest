import { describe, expect, it } from "vitest";
import { VideoId, type Overview } from "@overview/domain";
import { makeOverview, makeOverviewState } from "../overviews/types/OverviewFactory.testHelper.js";
import { makeTopic } from "../overviews/types/TopicFactory.testHelper.js";
import { makeStoredTranscript } from "../transcripts/types/StoredTranscriptFactory.testHelper.js";
import { MovingLibrary } from "./MovingLibrary.testHelper.js";
import { moveLibraryInto } from "./moveLibraryInto.js";

const library = () => new MovingLibrary();

const ofVideo = (videoId: string, overrides: Partial<Overview> = {}): Overview => {
  const overview = makeOverview(overrides);
  return { ...overview, video: { ...overview.video, id: VideoId.parse(videoId) } };
};

describe("moveLibraryInto", () => {
  it("moves every overview into the account and leaves nothing behind", async () => {
    const from = library();
    const into = library();
    from.seedOverview(ofVideo("one"));
    from.seedOverview(ofVideo("two"));

    const move = await moveLibraryInto(from, into);

    expect(move).toMatchObject({ moved: 2, alreadyThere: 0 });
    expect((await into.overviewStore.listOverviews()).map(({ video }) => video.id).sort()).toEqual(["one", "two"]);
    expect(await from.overviewStore.listOverviews()).toEqual([]);
  });

  it("keeps the account's copy of a video it already has, and lets this one go", async () => {
    const from = library();
    const into = library();
    const accounts = ofVideo("shared", { captureReason: "the account's" });
    into.seedOverview(accounts);
    from.seedOverview(ofVideo("shared", { captureReason: "this device's" }));

    const move = await moveLibraryInto(from, into);

    expect(move).toMatchObject({ moved: 0, alreadyThere: 1 });
    expect(await into.overviewStore.listOverviews()).toEqual([accounts]);
    expect(await from.overviewStore.listOverviews()).toEqual([]);
  });

  it("files a moved overview under the account's topic of the same name, and makes the rest", async () => {
    const from = library();
    const into = library();
    const accountTopic = makeTopic({ name: "Energy" });
    into.seedTopic(accountTopic);
    const sameName = makeTopic({ name: "energy " });
    const newOne = makeTopic({ name: "Baking" });
    from.seedTopic(sameName);
    from.seedTopic(newOne);
    from.seedOverview(ofVideo("one", { topicIds: [sameName.id, newOne.id] }));

    await moveLibraryInto(from, into);

    const [moved] = await into.overviewStore.listOverviews();
    const topics = await into.overviewStore.listTopics();
    expect(topics.map(({ name }) => name).sort()).toEqual(["Baking", "Energy"]);
    expect(moved?.topicIds).toEqual([accountTopic.id, topics.find(({ name }) => name === "Baking")?.id]);
  });

  it("brings what the reader did to it, and its transcript", async () => {
    const from = library();
    const into = library();
    const overview = ofVideo("one");
    from.seedOverview(overview);
    from.seedState(makeOverviewState(overview.id, { read: true, favourite: true }));
    from.seedTranscript(makeStoredTranscript({ videoId: VideoId.parse("one") }));

    await moveLibraryInto(from, into);

    expect(await into.overviewStore.getOverviewState(overview.id)).toMatchObject({ read: true, favourite: true });
    expect(await into.transcriptStore.getTranscript(VideoId.parse("one"))).not.toBeNull();
    expect(await from.transcriptStore.getTranscript(VideoId.parse("one"))).toBeNull();
  });

  it("finishes a move that stopped halfway, without a second copy", async () => {
    const from = library();
    const into = library();
    const arrived = ofVideo("arrived");
    into.seedOverview(arrived);
    from.seedOverview(arrived);
    from.seedOverview(ofVideo("not yet"));

    const move = await moveLibraryInto(from, into);

    expect(move).toMatchObject({ moved: 1, alreadyThere: 1 });
    expect(await into.overviewStore.listOverviews()).toHaveLength(2);
    expect(await from.overviewStore.listOverviews()).toEqual([]);
  });
});
