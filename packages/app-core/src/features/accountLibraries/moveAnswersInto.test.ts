import { describe, expect, it } from "vitest";
import { aboutYouPatch, DEFAULT_ACCENT_COLOUR, DEFAULT_NARRATION_VOICE, DEFAULT_THEME_MODE, EMPTY_ABOUT_YOU } from "@overview/domain";
import { makeTopic } from "../overviews/types/TopicFactory.testHelper.js";
import { MovingLibrary } from "./MovingLibrary.testHelper.js";
import { moveAnswersInto } from "./moveAnswersInto.js";

const NURSE = { ...EMPTY_ABOUT_YOU, who: ["nurse"] };
const TEACHER = { ...EMPTY_ABOUT_YOU, who: ["teacher"] };

const library = () => new MovingLibrary();

describe("moveAnswersInto", () => {
  it("brings every topic in with its description, even one nothing is sorted under yet", async () => {
    const from = library();
    const into = library();
    from.seedTopic(makeTopic({ name: "Food", description: "Cooking, recipes and eating well." }));
    from.seedTopic(makeTopic({ name: "chess", description: null }));

    await moveAnswersInto(from, into);

    const topics = await into.overviewStore.listTopics();
    expect(topics.map(({ name, description }) => ({ name, description }))).toEqual([
      { name: "Food", description: "Cooking, recipes and eating well." },
      { name: "chess", description: null },
    ]);
  });

  it("leaves a topic the account already has by that name as the account has it", async () => {
    const from = library();
    const into = library();
    const accounts = makeTopic({ name: "food", description: null });
    into.seedTopic(accounts);
    from.seedTopic(makeTopic({ name: "Food", description: "Cooking, recipes and eating well." }));

    await moveAnswersInto(from, into);

    expect(await into.overviewStore.listTopics()).toEqual([accounts]);
  });

  it("gives an account with no About you and the default voice this device's, and clears them here", async () => {
    const from = library();
    const into = library();
    await from.settingsStore.update({ ...aboutYouPatch(NURSE), narrationVoice: "bm_george" });

    await moveAnswersInto(from, into);

    expect(await into.settingsStore.get()).toMatchObject({
      aboutYou: NURSE,
      readerContext: "I'm a nurse.",
      narrationVoice: "bm_george",
    });
    expect(await from.settingsStore.get()).toMatchObject({
      aboutYou: EMPTY_ABOUT_YOU,
      readerContext: null,
      narrationVoice: DEFAULT_NARRATION_VOICE,
    });
  });

  it("gives an account with the default appearance this device's, and clears it here", async () => {
    const from = library();
    const into = library();
    await from.settingsStore.update({ theme: "dark", accentColour: "teal" });

    await moveAnswersInto(from, into);

    expect(await into.settingsStore.get()).toMatchObject({ theme: "dark", accentColour: "teal" });
    expect(await from.settingsStore.get()).toMatchObject({
      theme: DEFAULT_THEME_MODE,
      accentColour: DEFAULT_ACCENT_COLOUR,
    });
  });

  it("keeps the account's own appearance over this device's", async () => {
    const from = library();
    const into = library();
    await into.settingsStore.update({ theme: "light", accentColour: "gold" });
    await from.settingsStore.update({ theme: "dark", accentColour: "teal" });

    await moveAnswersInto(from, into);

    expect(await into.settingsStore.get()).toMatchObject({ theme: "light", accentColour: "gold" });
  });

  it("keeps the account's own About you and voice over this device's", async () => {
    const from = library();
    const into = library();
    await into.settingsStore.update({ ...aboutYouPatch(TEACHER), narrationVoice: "af_nova" });
    await from.settingsStore.update({ ...aboutYouPatch(NURSE), narrationVoice: "bm_george" });

    await moveAnswersInto(from, into);

    expect(await into.settingsStore.get()).toMatchObject({ aboutYou: TEACHER, narrationVoice: "af_nova" });
  });
});
