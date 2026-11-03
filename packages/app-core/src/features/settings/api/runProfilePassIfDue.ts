import {
  aboutYouSentence,
  keptLearnedItems,
  learnedItemKey,
  PROFILE_PASS_RECENT_OVERVIEWS,
  PROFILE_PASS_REMOVED_ITEMS,
  profilePassIsDue,
  removedLearnedItems,
  type KeySource,
  type LearnedItems,
  type OverviewStore,
  type ProfilePassItem,
  type SettingsStore,
} from "@overview/domain";
import { generateProfileItems, type GenerationClient } from "@overview/generation";
import type { GenerationApi } from "@overview/sync";
import type { Analytics } from "../../analytics/createAnalytics.js";

export interface ProfilePassDeps {
  madeOn: KeySource | null;
  own: GenerationClient | null;
  api: Pick<GenerationApi, "profilePass"> | null;
  overviewStore: Pick<OverviewStore, "listOverviews" | "listTopics">;
  settingsStore: Pick<SettingsStore, "get" | "update">;
  analytics: Pick<Analytics, "settings">;
  now?: () => Date;
}

// Runs after an overview lands, on the key that made it. Its failing never touches the overview
// and nothing tells the reader, so it is counted and left; the next due pass picks up from here
// (docs/features/personalisation.md, "A profile that learns"). True when Settings changed.
export async function runProfilePassIfDue({ madeOn, own, api, overviewStore, settingsStore, analytics, now = () => new Date() }: ProfilePassDeps): Promise<boolean> {
  const passAsks = madeOn === "own" && own !== null ? "own" : madeOn === "ours" && api !== null ? "ours" : null;
  if (passAsks === null) return false;
  const counted = analytics.settings.personalisation;
  try {
    const [settings, overviews, topics] = await Promise.all([settingsStore.get(), overviewStore.listOverviews(), overviewStore.listTopics()]);
    const schedule = {
      overviewCount: overviews.length,
      countAtLastPass: settings.overviewsAtLastProfilePass,
      keepLearning: settings.keepLearning,
    };
    if (!profilePassIsDue(schedule)) return false;
    await settingsStore.update({ overviewsAtLastProfilePass: overviews.length });

    const recent = [...overviews].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, PROFILE_PASS_RECENT_OVERVIEWS);
    const sentence = aboutYouSentence(settings.aboutYou);
    const input = {
      sentence: sentence === "" ? null : sentence,
      learned: keptLearnedItems(settings.learned).map(({ text }) => text),
      removed: removedLearnedItems(settings.learned)
        .slice(0, PROFILE_PASS_REMOVED_ITEMS)
        .map(({ text }) => text),
      overviews: recent.map((overview) => ({
        title: overview.source.title,
        premise: overview.inOneLine,
        topics: overview.topicIds.flatMap((id) => topics.find((topic) => topic.id === id)?.name ?? []),
        captureReason: overview.captureReason,
      })),
    };
    const items: ProfilePassItem[] =
      passAsks === "own" ? await generateProfileItems(own!, input) : (await api!.profilePass(input)).items;
    counted.profilePassRan({ added: items.length, key: passAsks });
    if (items.length === 0) return true;

    const learnedAt = now().toISOString();
    const learned: LearnedItems = Object.fromEntries(
      items.map(({ text, source }) => [learnedItemKey(text), { text, source, learnedAt, noticedAt: null, removedAt: null }]),
    );
    await settingsStore.update({ learned });
    return true;
  } catch {
    counted.profilePassFailed({ key: passAsks });
    return false;
  }
}
