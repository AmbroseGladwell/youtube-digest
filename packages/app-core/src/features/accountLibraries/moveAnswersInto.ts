import {
  DEFAULT_ACCENT_COLOUR,
  DEFAULT_NARRATION_VOICE,
  DEFAULT_THEME_MODE,
  sameTopicName,
  type OverviewStore,
  type Settings,
  type SettingsStore,
} from "@overview/domain";

export interface AnswerStores {
  overviewStore: Pick<OverviewStore, "listTopics" | "createTopic">;
  settingsStore: Pick<SettingsStore, "get" | "update">;
}

// What onboarding asked before there was an account: its topics, with their descriptions,
// whether or not an overview is sorted under them yet, and About you, the voice and the
// appearance. The account's own win; this device's apply only where the account has none.
// Moved before the overviews, so a topic the move finds by name already carries its
// description (docs/features/onboarding.md, "Into the account").
export async function moveAnswersInto(from: AnswerStores, into: AnswerStores): Promise<void> {
  const [leavingTopics, accountTopics, leaving, held] = await Promise.all([
    from.overviewStore.listTopics(),
    into.overviewStore.listTopics(),
    from.settingsStore.get(),
    into.settingsStore.get(),
  ]);

  for (const topic of leavingTopics) {
    if (accountTopics.some((held) => sameTopicName(held.name, topic.name))) continue;
    accountTopics.push(
      await into.overviewStore.createTopic(
        topic.description === null ? { name: topic.name } : { name: topic.name, description: topic.description },
      ),
    );
  }

  const patch: Partial<Settings> = {
    ...(held.readerContext === null && leaving.readerContext !== null ? { readerContext: leaving.readerContext } : {}),
    ...(held.narrationVoice === DEFAULT_NARRATION_VOICE && leaving.narrationVoice !== DEFAULT_NARRATION_VOICE
      ? { narrationVoice: leaving.narrationVoice }
      : {}),
    ...(held.theme === DEFAULT_THEME_MODE && leaving.theme !== DEFAULT_THEME_MODE ? { theme: leaving.theme } : {}),
    ...(held.accentColour === DEFAULT_ACCENT_COLOUR && leaving.accentColour !== DEFAULT_ACCENT_COLOUR
      ? { accentColour: leaving.accentColour }
      : {}),
  };
  if (Object.keys(patch).length > 0) await into.settingsStore.update(patch);
  const leavingAnswers =
    leaving.readerContext !== null ||
    leaving.narrationVoice !== DEFAULT_NARRATION_VOICE ||
    leaving.theme !== DEFAULT_THEME_MODE ||
    leaving.accentColour !== DEFAULT_ACCENT_COLOUR;
  if (leavingAnswers) {
    await from.settingsStore.update({
      readerContext: null,
      narrationVoice: DEFAULT_NARRATION_VOICE,
      theme: DEFAULT_THEME_MODE,
      accentColour: DEFAULT_ACCENT_COLOUR,
    });
  }
}
