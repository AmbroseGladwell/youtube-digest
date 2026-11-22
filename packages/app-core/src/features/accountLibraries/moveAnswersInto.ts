import {
  aboutYouIsEmpty,
  aboutYouPatch,
  DEFAULT_ACCENT_COLOUR,
  DEFAULT_NARRATION_VOICE,
  DEFAULT_THEME_MODE,
  EMPTY_ABOUT_YOU,
  sameTopicName,
  type OverviewStore,
  type Settings,
  type SettingsStore,
} from "@overview/domain";

export interface AnswerStores {
  overviewStore: Pick<OverviewStore, "listTopics" | "createTopic">;
  settingsStore: Pick<SettingsStore, "get" | "update">;
}

// Why the account's answers win, and go first: docs/features/onboarding.md, "Into the account".
export const moveAnswersInto = async (from: AnswerStores, into: AnswerStores): Promise<void> => {
  const [leavingTopics, accountTopics, leaving, held] = await Promise.all([
    from.overviewStore.listTopics(),
    into.overviewStore.listTopics(),
    from.settingsStore.get(),
    into.settingsStore.get(),
  ]);

  for (const topic of leavingTopics) {
    if (accountTopics.some((held) => sameTopicName(held.name, topic.name))) {
      continue;
    }
    accountTopics.push(
      await into.overviewStore.createTopic(
        topic.description === null ? { name: topic.name } : { name: topic.name, description: topic.description },
      ),
    );
  }

  const patch: Partial<Settings> = {
    ...(aboutYouIsEmpty(held.aboutYou) && !aboutYouIsEmpty(leaving.aboutYou) ? aboutYouPatch(leaving.aboutYou) : {}),
    ...(held.narrationVoice === DEFAULT_NARRATION_VOICE && leaving.narrationVoice !== DEFAULT_NARRATION_VOICE
      ? { narrationVoice: leaving.narrationVoice }
      : {}),
    ...(held.theme === DEFAULT_THEME_MODE && leaving.theme !== DEFAULT_THEME_MODE ? { theme: leaving.theme } : {}),
    ...(held.accentColour === DEFAULT_ACCENT_COLOUR && leaving.accentColour !== DEFAULT_ACCENT_COLOUR
      ? { accentColour: leaving.accentColour }
      : {}),
  };
  if (Object.keys(patch).length > 0) {
    await into.settingsStore.update(patch);
  }
  const leavingAnswers =
    !aboutYouIsEmpty(leaving.aboutYou) ||
    leaving.narrationVoice !== DEFAULT_NARRATION_VOICE ||
    leaving.theme !== DEFAULT_THEME_MODE ||
    leaving.accentColour !== DEFAULT_ACCENT_COLOUR;
  if (leavingAnswers) {
    await from.settingsStore.update({
      ...aboutYouPatch(EMPTY_ABOUT_YOU),
      narrationVoice: DEFAULT_NARRATION_VOICE,
      theme: DEFAULT_THEME_MODE,
      accentColour: DEFAULT_ACCENT_COLOUR,
    });
  }
};
