import { z } from "zod";
import { OverviewId, TopicId } from "./Brands.js";
import { MilestoneId, MilestoneLineControl } from "./Milestone.js";
import { Plan } from "./Plan.js";
import { Novelty } from "./Verdict.js";
import { WatchAnswer } from "./WatchAnyway.js";

// A property can only be a choice, a flag, a number or one of our own random ids: nothing
// that could carry a URL, a video id or a sentence the reader wrote
// (docs/architecture/analytics.md, "What an event may carry").
export const ANALYTICS_IDS = [OverviewId, TopicId] as const;
export type AnalyticsProp = z.ZodEnum | z.ZodBoolean | z.ZodNumber | (typeof ANALYTICS_IDS)[number];
export type AnalyticsProps = Record<string, AnalyticsProp>;

export interface AnalyticsEventDefinition<P extends AnalyticsProps = AnalyticsProps> {
  description: string;
  props: P;
}

export type AnalyticsCatalogueShape = Record<string, Record<string, Record<string, AnalyticsEventDefinition>>>;

function event(description: string): AnalyticsEventDefinition<{}>;
function event<P extends AnalyticsProps>(description: string, props: P): AnalyticsEventDefinition<P>;
function event(description: string, props: AnalyticsProps = {}): AnalyticsEventDefinition {
  return { description, props };
}

type ScreenEvents = Record<string, Record<string, AnalyticsEventDefinition>>;

type WithOverviewId<Screens extends ScreenEvents> = {
  [Screen in keyof Screens]: {
    [Action in keyof Screens[Screen]]: Screens[Screen][Action] extends AnalyticsEventDefinition<infer P>
      ? AnalyticsEventDefinition<P & { overviewId: typeof OverviewId }>
      : never;
  };
};

const withOverviewId = <Screens extends ScreenEvents>(screens: Screens): WithOverviewId<Screens> =>
  Object.fromEntries(
    Object.entries(screens).map(([screen, events]) => [
      screen,
      Object.fromEntries(
        Object.entries(events).map(([action, { description, props }]) => [
          action,
          { description, props: { ...props, overviewId: OverviewId } },
        ]),
      ),
    ]),
  ) as WithOverviewId<Screens>;

export const ReaderTabChoice = z.enum(["overview", "transcript", "chapters"]);
export type ReaderTabChoice = z.infer<typeof ReaderTabChoice>;
const Direction = z.enum(["previous", "next"]);
const SkipDirection = z.enum(["back", "forward"]);
// A moment in the video is reached by moving the player beside the panel, or by a link out to YouTube.
const VideoReach = z.enum(["skip", "youtube"]);
const PlayerMainButton = z.enum(["play", "pause", "cancel", "buffering", "replay"]);
const PlayerBarAction = z.enum(["tryAgain", "readAlongInstead", "readAlong", "readAlongMeanwhile", "markRead", "signIn"]);
const OverviewControl = z.enum(["masthead", "actionsMenu", "playerBar"]);
export const OverviewMenuItem = z.enum([
  "editTopics",
  "editReason",
  "toggleRead",
  "share",
  "watchOnYouTube",
  "copyYouTubeLink",
  "openInWebApp",
  "delete",
]);
export type OverviewMenuItem = z.infer<typeof OverviewMenuItem>;

// The reader's tabs, note, transcript, chapters and player, wherever an overview is read: the
// reader page sends them as reader.* with the overview's id, and a shared link as
// sharedPage.*, where the server adds the id from the share (docs/architecture/analytics.md,
// "One overview's events").
export const overviewPageEvents = {
  tabs: {
    switched: event("The reader switches between the overview, transcript and chapters tabs", { tab: ReaderTabChoice }),
  },
  readAlong: {
    lineChosen: event("The reader picks a line of the note to listen from"),
  },
  watchAnyway: {
    followed: event("The reader goes to the stretch of the video the verdict says is worth watching", {
      by: VideoReach,
    }),
  },
  chapters: {
    transcriptOpened: event("The reader opens the transcript at a chapter's start"),
    videoOpened: event("The reader goes to a chapter's start in the video", { by: VideoReach }),
  },
  transcript: {
    searched: event("The reader searches the transcript, counted once they stop typing; never the words", {
      matches: z.number().int().nonnegative(),
    }),
    searchCleared: event("The reader clears the transcript search"),
    matchStepped: event("The reader steps to the previous or next search match", { direction: Direction }),
    copied: event("The reader copies the whole transcript"),
    exported: event("The reader downloads the transcript as a text file"),
    followResumed: event("The reader asks the transcript to follow the video again"),
    timestampChosen: event("The reader goes to a transcript block's moment in the video", { by: VideoReach }),
    backToChapters: event("The reader goes back to the chapter that opened the transcript"),
    retried: event("The reader tries loading a transcript that failed again"),
  },
  playerBar: {
    mainPressed: event("The reader presses the player's main button, named by what it showed", {
      button: PlayerMainButton,
    }),
    skipped: event("The reader skips back or forward by the player's step", { direction: SkipDirection }),
    seeked: event("The reader moves the player's position with the scrubber"),
    rateChanged: event("The reader changes the playback speed, to the speed chosen", { rate: z.number().positive() }),
    actionChosen: event("The reader picks one of the player's offered actions", { action: PlayerBarAction }),
    reRecordChosen: event("The reader asks for the narration to be recorded again in their current voice"),
    voiceLinkFollowed: event("The reader follows the player's voice name to Settings › Narration voice"),
  },
} as const satisfies ScreenEvents;

export type OverviewPageEvents = typeof overviewPageEvents;

// Every event is something the reader did in the app: a click, a choice, a thing they made.
// What the app or the server did on its own is logged, never an event
// (docs/architecture/analytics.md, "Actions, not logs"). Each is named feature.screen.action
// so a name says where it happened without a lookup ("Naming"), and its description is
// what someone reading the numbers is told it means.
export const analyticsEvents = {
  reader: withOverviewId({
    ...overviewPageEvents,
    page: {
      opened: event("The reader opens an overview, with what its verdict said and the state it was in", {
        answer: z.enum([...WatchAnswer.options, "none"]),
        novelty: z.enum([...Novelty.options, "none"]),
        dubious: z.boolean(),
        read: z.boolean(),
        favourite: z.boolean(),
      }),
      neighbourFollowed: event("The reader steps to the previous or next overview from the reader's foot", {
        direction: Direction,
      }),
      backFollowed: event("The reader goes back to all overviews from the reader's head"),
      lineStepped: event("The reader steps a line of the note with the [ and ] keys", { direction: Direction }),
    },
    overview: {
      readSwitched: event("The reader marks the overview read or unread, to the state chosen", {
        read: z.boolean(),
        from: OverviewControl,
      }),
      favouriteSwitched: event("The reader favourites or unfavourites the overview, to the state chosen", {
        favourite: z.boolean(),
        from: OverviewControl,
      }),
      listenPressed: event("The reader presses Listen in the reader's head, to the state chosen", { listening: z.boolean() }),
    },
    actionsMenu: {
      opened: event("The reader opens the overview's ⋯ menu"),
      closed: event("The reader closes the overview's ⋯ menu without choosing anything"),
      itemChosen: event("The reader picks an item from the overview's ⋯ menu", { item: OverviewMenuItem }),
    },
    topics: {
      added: event("The reader files the overview under a topic", { topicId: TopicId }),
      removed: event("The reader takes the overview out of a topic", { topicId: TopicId }),
      created: event("The reader creates a new topic from the overview's topic picker"),
      searched: event("The reader searches the topic picker, counted once they stop typing; never the words", {
        matches: z.number().int().nonnegative(),
      }),
      pickerClosed: event("The reader closes the overview's topic picker"),
    },
    captureReason: {
      saved: event("The reader saves why they saved the overview; never the reason itself", { edited: z.boolean() }),
      removed: event("The reader removes why they saved the overview"),
      cancelled: event("The reader closes the capture reason editor without saving"),
    },
    deleteDialog: {
      confirmed: event("The reader confirms deleting the overview"),
      cancelled: event("The reader backs out of deleting the overview"),
    },
    shareDialog: {
      created: event("The reader makes a share link for the overview"),
      updated: event("The reader replaces the shared copy with the overview as it is now"),
      stopAsked: event("The reader asks to stop sharing the overview, before confirming"),
      stopped: event("The reader confirms stopping sharing the overview"),
      stopCancelled: event("The reader backs out of stopping sharing the overview"),
      linkCopied: event("The reader copies the overview's share link"),
      systemShareOpened: event("The reader hands the share link to their device's own share sheet"),
      signInChosen: event("The reader chooses to sign in from the share dialog, which needs an account"),
      closed: event("The reader closes the share dialog"),
    },
  }),
  sharedPage: {
    ...overviewPageEvents,
    page: {
      opened: event("Someone opens a shared overview's link, or a link that has been stopped", { stopped: z.boolean() }),
    },
    actions: {
      saveChosen: event("Someone reading a shared overview chooses to save it to their own overviews"),
      watchOnYouTubeChosen: event("Someone reading a shared overview opens the video on YouTube"),
    },
    header: {
      homeChosen: event("Someone on a shared overview follows the wordmark to the app's home"),
      signInChosen: event("Someone on a shared overview chooses Sign in from the header"),
      makeChosen: event("Someone on a shared overview chooses Make an overview from the header"),
    },
    makeYourOwn: {
      linkEntered: event("Someone on a shared overview types or pastes a video link to make their own; never the link", {
        recognised: z.boolean(),
      }),
      submitted: event("Someone on a shared overview asks to make an overview of a video they pasted", {
        recognised: z.boolean(),
      }),
      signInChosen: event("Someone on a shared overview chooses Sign in beside making their own"),
    },
    gone: {
      makeChosen: event("Someone on a stopped or unknown shared link chooses to make an overview of their own"),
    },
  },
  mcp: {
    consentScreen: {
      shown: event("An assistant's request to connect over MCP is shown on the consent screen"),
      plusRequired: event("A reader on Free is told on the consent screen that connecting an assistant needs Plus"),
      approved: event("The reader approves an assistant's request to connect"),
      declined: event("The reader declines an assistant's request to connect", { plan: Plan }),
    },
    settingsConnections: {
      revoked: event("The reader revokes an assistant's access in Settings › Connections"),
    },
  },
  timeSaved: {
    library: {
      breakdownOpened: event("The reader opens the time-saved breakdown from the library's running total"),
    },
    milestoneCard: {
      dismissed: event("The reader dismisses a time-saved milestone card", { milestone: MilestoneId }),
      dismissalUndone: event("The reader undoes dismissing a time-saved milestone card", { milestone: MilestoneId }),
      lineChosen: event("The reader moves a milestone card to another of its lines, by swiping, the arrow keys or a dot", {
        milestone: MilestoneId,
        by: MilestoneLineControl,
      }),
    },
    settingsMilestones: {
      opened: event("The reader opens Settings › Milestones"),
      milestonePicked: event("The reader picks a reached milestone in Settings › Milestones to see its card again", {
        milestone: MilestoneId,
      }),
      cardsSwitched: event("The reader turns the milestone cards on or off in Settings › Milestones", {
        shown: z.boolean(),
      }),
    },
  },
} as const satisfies AnalyticsCatalogueShape;

export type AnalyticsCatalogue = typeof analyticsEvents;

export type AnalyticsEventName = {
  [Feature in keyof AnalyticsCatalogue]: {
    [Screen in keyof AnalyticsCatalogue[Feature]]: `${Feature & string}.${Screen & string}.${keyof AnalyticsCatalogue[Feature][Screen] & string}`;
  }[keyof AnalyticsCatalogue[Feature]];
}[keyof AnalyticsCatalogue];

export type AnalyticsEventPropsOf<D> =
  D extends AnalyticsEventDefinition<infer P> ? { [Key in keyof P]: z.infer<P[Key]> } : never;

const flattenCatalogue = (catalogue: AnalyticsCatalogueShape): Map<string, AnalyticsEventDefinition> =>
  new Map(
    Object.entries(catalogue).flatMap(([feature, screens]) =>
      Object.entries(screens).flatMap(([screen, events]) =>
        Object.entries(events).map(([action, definition]) => [`${feature}.${screen}.${action}`, definition] as const),
      ),
    ),
  );

export const analyticsEventDefinitions: ReadonlyMap<string, AnalyticsEventDefinition> = flattenCatalogue(analyticsEvents);

export const isAnalyticsEventName = (name: string): name is AnalyticsEventName =>
  analyticsEventDefinitions.has(name);
