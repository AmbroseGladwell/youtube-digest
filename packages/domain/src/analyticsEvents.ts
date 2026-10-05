import { z } from "zod";
import { OverviewId, TopicId } from "./Brands.js";
import { MilestoneId, MilestoneLineControl } from "./Milestone.js";
import { Plan } from "./Plan.js";
import { AnthropicModel } from "./AnthropicModel.js";
import { AuthIntent } from "./AuthIntent.js";
import { NarrationVoice } from "./NarrationVoice.js";
import { MAX_DUBIOUS_CLAIMS, Novelty } from "./Verdict.js";
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
const RangeReach = z.enum([...VideoReach.options, "transcript"]);
const PlayerMainButton = z.enum(["play", "pause", "cancel", "buffering", "replay"]);
const PlayerBarAction = z.enum(["tryAgain", "readAlongInstead", "readAlong", "readAlongMeanwhile", "markRead", "signIn"]);
const OverviewControl = z.enum(["masthead", "actionsMenu", "playerBar"]);
// Where a library filter was changed: the rail or its sheet, an applied chip's ×, Show all,
// Reset, or the caught-up list's way out.
const FilterControl = z.enum(["panel", "appliedChip", "clearAll", "reset", "caughtUp"]);
const LibrarySort = z.enum(["newest", "oldest", "title"]);
// Where a new overview was asked for.
export const CaptureEntry = z.enum(["dialog", "home", "panel", "injectedButton", "sharedPage", "regenerate"]);
export type CaptureEntry = z.infer<typeof CaptureEntry>;
// Which rung answered for the transcript, or the device's own copy (docs/features/transcript-retrieval.md).
export const CaptureTranscriptSource = z.enum(["stored", "shared-cache", "extension", "service"]);
export type CaptureTranscriptSource = z.infer<typeof CaptureTranscriptSource>;
// A transcript failure by its TranscriptFetchFailure name, or what went wrong past it.
export const CaptureFailure = z.enum([
  "no-captions",
  "video-unavailable",
  "access-restricted",
  "source-blocked",
  "rate-limited",
  "source-unavailable",
  "malformed-response",
  "source-unsupported",
  "budget-exhausted",
  "noTranscriptSource",
  "generation",
  "unknown",
]);
export type CaptureFailure = z.infer<typeof CaptureFailure>;
const RunState = z.enum(["running", "ready", "failed"]);
// Which of the app's dead ends a reader was on, named because its title is copy
// (docs/features/error-state.md).
export const ErrorScreen = z.enum([
  "routeError",
  "outOfDateTab",
  "libraryLocked",
  "libraryUnopenable",
  "notFound",
  "overviewLoad",
  "unreadableOverview",
  "libraryLoad",
  "topicsLoad",
  "accountsUnavailable",
  "extensionSessionEnded",
  "extensionCodeFailed",
  "signInLinkFailed",
  "writeFloor",
  "consentExpired",
  "consentLoad",
]);
export type ErrorScreen = z.infer<typeof ErrorScreen>;
export const AccountMenuItem = z.enum([
  "settings",
  "connectExtension",
  "signInAgain",
  "signOut",
  "enterCode",
  "signIn",
  "createAccount",
]);
export type AccountMenuItem = z.infer<typeof AccountMenuItem>;
export const SettingsSection = z.enum(["account", "voice", "keys", "connections", "milestones", "shared", "plan", "privacy", "about"]);
const LinkCodeFrom = z.enum(["emailLink", "webApp"]);
const SignInCodeFrom = z.enum(["emailLink", "webApp", "emailCode"]);
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
    rangeFollowed: event("The reader goes to the stretch of the video a key point or what stands out comes from", {
      line: z.enum(["keyPoint", "standsOut"]),
      by: RangeReach,
    }),
  },
  watchAnyway: {
    followed: event("The reader goes to the stretch of the video the verdict says is worth watching", {
      by: RangeReach,
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
    dubiousReasons: {
      opened: event("The reader opens why the overview is marked dubious, with how many reasons it saved; none means it was made before reasons were", {
        reasonsSaved: z.number().int().min(0).max(MAX_DUBIOUS_CLAIMS),
      }),
      momentFollowed: event("The reader goes to a dubious claim's moment in the video", { by: VideoReach }),
      markedWrong: event("The reader says the dubious flag looks wrong"),
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
  extension: {
    injectedButton: {
      pressed: event("The reader presses the button the extension puts on a YouTube video, and what it did", {
        outcome: z.enum(["openedHeld", "keysNeeded", "started"]),
      }),
    },
    sidePanel: {
      opened: event("The reader opens the extension's side panel"),
    },
  },
  app: {
    masthead: {
      homeChosen: event("The reader follows the wordmark home"),
      overviewsChosen: event("The reader follows Overviews in the masthead"),
      notNowChosen: event("The reader leaves sign-in or account creation with Not now"),
    },
    accountMenu: {
      opened: event("The reader opens the account menu"),
      closed: event("The reader closes the account menu without choosing anything"),
      itemChosen: event("The reader picks an item from the account menu", { item: AccountMenuItem }),
    },
    errorState: {
      actionChosen: event("The reader takes the way out a dead-end screen offers: trying again, or leaving for the video", {
        screen: ErrorScreen,
      }),
      backChosen: event("The reader goes back to their overviews from a dead-end screen", { screen: ErrorScreen }),
    },
    staleClientBanner: {
      updateChosen: event("The reader reloads or updates the app from the newer-version banner"),
      dismissed: event("The reader dismisses the newer-version banner"),
    },
  },
  player: {
    miniPlayer: {
      overviewOpened: event("The reader opens the playing overview from the mini-player", { overviewId: OverviewId }),
      skipped: event("The reader skips back or forward from the mini-player", {
        overviewId: OverviewId,
        direction: SkipDirection,
      }),
      playToggled: event("The reader plays or pauses from the mini-player, to the state chosen", {
        overviewId: OverviewId,
        playing: z.boolean(),
      }),
      stopped: event("The reader stops and closes the mini-player", { overviewId: OverviewId }),
    },
  },
  plus: {
    savedLocallyNote: {
      seePlusChosen: event("The reader follows See Plus from the note that a new overview is saved only on this browser"),
      dismissed: event("The reader dismisses the note that a new overview is saved only on this browser"),
    },
    planPanel: {
      connectionsChosen: event("The reader follows the assistant feature from the plan panel to Connections"),
      recheckChosen: event("The reader asks to check their plan again after it couldn't be checked"),
    },
  },
  account: {
    signIn: {
      linkRequested: event("The reader asks for a sign-in link; never the address", {
        intent: AuthIntent,
        from: z.enum(["signInPage", "consentScreen"]),
        resend: z.boolean(),
      }),
      differentEmailChosen: event("The reader goes back to use a different email address", {
        from: z.enum(["checkEmail", "enterCode", "consentScreen"]),
      }),
      switchChosen: event("The reader switches between signing in and creating an account", { to: AuthIntent }),
      serverFieldShown: event("The reader asks to name a different server to sign in to"),
      codeSubmitted: event("The reader types a code to sign in, into the extension or, from the mail, into the web app; never the code", {
        from: SignInCodeFrom,
      }),
      emailCodeChosen: event("The reader chooses to sign the web app in with the code from the mail rather than its link"),
      webAppCodeChosen: event("The reader chooses to sign the extension in with a code from the web app"),
      emailInsteadChosen: event("The reader goes back from entering a code to signing in by email"),
      welcomeDone: event("The reader leaves the welcome shown after signing in"),
      notYouChosen: event("The reader signs out from the consent screen's Not you?"),
      libraryMoved: event(
        "Signing in moved this device's overviews into the account: how many were added, and how many the account already had a copy of",
        { moved: z.number().int().nonnegative(), alreadyThere: z.number().int().nonnegative() },
      ),
    },
    linkCode: {
      copied: event("The reader copies a code for signing the extension in", { from: LinkCodeFrom }),
      renewed: event("The reader asks for a new code for signing the extension in"),
    },
    signOut: {
      finished: event(
        "The reader's sign-out went through: what its last sync left unsent, what the server had refused, whether the device was offline and whether the sync was given up on",
        {
          pending: z.number().int().nonnegative(),
          stuck: z.number().int().nonnegative(),
          offline: z.boolean(),
          timedOut: z.boolean(),
        },
      ),
    },
    signedOutStrip: {
      signInChosen: event("The reader follows Sign in from the strip a signed-out library carries"),
    },
    signedOutLibrary: {
      signInChosen: event("The reader follows Sign in from the empty library shown after signing out"),
    },
    movedNotice: {
      dismissed: event("The reader closes the notice saying which overviews signing in added to the account"),
    },
    accountOffer: {
      createAccountChosen: event("The reader follows Create account from the strip offering an account"),
      dismissed: event("The reader turns down the strip offering an account, which hides it on this device"),
    },
  },
  analyticsConsent: {
    prompt: {
      accepted: event(
        "A reader with no account agrees to share usage from the library's prompt, the first event they send; whether it was the first ask or an ask after what is counted changed",
        { asked: z.enum(["first", "again"]) },
      ),
    },
    settings: {
      switched: event(
        "The reader turns Share usage on or off in Settings › Privacy; sent before an off takes effect, so it is the last event under that yes",
        { on: z.boolean() },
      ),
    },
  },
  settings: {
    page: {
      sectionOpened: event("The reader opens a section of Settings from its list", { section: SettingsSection }),
      backToSettingsChosen: event("The reader goes back from a section to the list of Settings"),
      overviewsChosen: event("The reader leaves Settings for their overviews"),
    },
    apiKeys: {
      saved: event("The reader saves their keys and model; never a key, only whether one is set", {
        anthropicKey: z.boolean(),
        model: AnthropicModel,
        modelChanged: z.boolean(),
      }),
    },
    voice: {
      chosen: event("The reader chooses the voice their notes are narrated in", { voice: NarrationVoice }),
      samplePlayed: event("The reader plays a voice's sample", { voice: NarrationVoice }),
      sampleStopped: event("The reader stops a voice's sample", { voice: NarrationVoice }),
      samplesRetried: event("The reader tries loading the voice samples again"),
    },
    sharedLinks: {
      linkCopied: event("The reader copies a share link from Settings › Shared links", { overviewId: OverviewId }),
      stopAsked: event("The reader asks to stop sharing from Settings › Shared links", { overviewId: OverviewId }),
      stopped: event("The reader confirms stopping sharing from Settings › Shared links", { overviewId: OverviewId }),
      stopCancelled: event("The reader keeps sharing after asking to stop in Settings › Shared links", {
        overviewId: OverviewId,
      }),
    },
    sync: {
      syncNowChosen: event("The reader asks to sync now"),
      signOutChosen: event("The reader signs out from Settings", { signedOutAtServer: z.boolean() }),
      connectExtensionChosen: event("The reader follows Connect the extension from Settings"),
      signInChosen: event("The reader follows Sign in from Settings"),
      createAccountChosen: event("The reader follows Create account from Settings"),
    },
  },
  capture: {
    newOverview: {
      started: event("The reader asks for an overview of a video, and where they asked from", { from: CaptureEntry }),
      finished: event(
        "An overview the reader asked for is made and saved, with the novelty it came out at and whether it named what stands out; its duration measured by the app",
        {
          overviewId: OverviewId,
          from: CaptureEntry,
          transcriptSource: CaptureTranscriptSource,
          durationMs: z.number().int().nonnegative(),
          reasonGiven: z.boolean(),
          novelty: z.enum([...Novelty.options, "none"]),
          standsOut: z.boolean(),
        },
      ),
      failed: event("An overview the reader asked for could not be made, and why", {
        from: CaptureEntry,
        failure: CaptureFailure,
        durationMs: z.number().int().nonnegative(),
      }),
    },
    newOverviewDialog: {
      opened: event("The reader opens the new overview dialog", { from: z.enum(["newButton", "statusStrip"]) }),
      closed: event("The reader closes the new overview dialog, leaving any run going", { run: z.enum(["none", ...RunState.options]) }),
      runCancelled: event("The reader cancels an overview being made"),
      runDismissed: event("The reader dismisses a finished or failed run", { run: RunState }),
      readChosen: event("The reader opens the overview they just made", {
        overviewId: OverviewId,
        from: z.enum(["dialog", "statusStrip", "panel"]),
      }),
    },
    newOverviewForm: {
      linkEntered: event("The reader types or pastes a video link, counted once they stop; never the link", {
        recognised: z.boolean(),
        from: z.enum(["dialog", "home"]),
      }),
      linkRefused: event("The reader submits something that isn't a YouTube link", { from: z.enum(["dialog", "home"]) }),
      watchingVideoUsed: event("The reader fills the link with the video they're watching"),
      clipboardPasted: event("The reader fills the link from the clipboard"),
      keysLinkFollowed: event("The reader follows the link to set up their keys before making an overview", {
        from: z.enum(["dialog", "home", "panel"]),
      }),
    },
    captureReason: {
      typed: event("The reader types why they saved an overview while it's made, once they stop; never the reason"),
    },
    panel: {
      createChosen: event("The reader asks the side panel for an overview of the video in front of it", {
        again: z.boolean(),
      }),
      readChosen: event("The reader opens the overview the library already holds for this video", {
        overviewId: OverviewId,
      }),
    },
  },
  library: {
    filters: {
      topicChosen: event("The reader filters the library to one topic", { topicId: TopicId, from: FilterControl }),
      topicCleared: event("The reader stops filtering the library by topic", { from: FilterControl }),
      noveltyChosen: event("The reader filters the library by the verdict's novelty, or back to all", {
        novelty: z.enum([...Novelty.options, "all"]),
        from: FilterControl,
      }),
      statusChosen: event("The reader filters the library by read or unread, or back to all", {
        status: z.enum(["all", "read", "unread"]),
        from: FilterControl,
      }),
      favouriteSwitched: event("The reader turns the favourites filter on or off", { on: z.boolean(), from: FilterControl }),
      dubiousSwitched: event("The reader turns the dubious-claims filter on or off", { on: z.boolean(), from: FilterControl }),
      allCleared: event("The reader shows every overview, clearing every library filter at once", {
        applied: z.number().int().nonnegative(),
      }),
      allTopicsShown: event("The reader shows or hides the topics past the first few", { shown: z.boolean() }),
      moreShown: event("The reader shows or hides the rail's further filters", { shown: z.boolean() }),
    },
    view: {
      reset: event("The reader resets the library to the default view", { applied: z.number().int().nonnegative() }),
    },
    caughtUp: {
      allShown: event("The reader with nothing unread asks to see every overview"),
    },
    filterSheet: {
      opened: event("The reader opens the filter sheet on a narrow screen"),
      closed: event("The reader closes the filter sheet on a narrow screen"),
    },
    search: {
      searched: event("The reader searches the library, counted once they stop typing; never the words", {
        results: z.number().int().nonnegative(),
      }),
      cleared: event("The reader clears the library search"),
    },
    sortPill: {
      opened: event("The reader opens the library's sort menu"),
      orderChosen: event("The reader picks an order for the library", { sort: LibrarySort }),
    },
    overviewCard: {
      opened: event("The reader opens an overview from its library row", {
        overviewId: OverviewId,
        from: z.enum(["title", "thumbnail"]),
      }),
      readSwitched: event("The reader marks a library row read or unread, to the state chosen", {
        overviewId: OverviewId,
        read: z.boolean(),
      }),
      favouriteSwitched: event("The reader favourites or unfavourites a library row, to the state chosen", {
        overviewId: OverviewId,
        favourite: z.boolean(),
      }),
      listenPressed: event("The reader presses Listen on a library row, to the state chosen", {
        overviewId: OverviewId,
        listening: z.boolean(),
      }),
    },
    unreadableCard: {
      opened: event("The reader opens an overview the app couldn't read from its library row"),
    },
    newTopicDialog: {
      opened: event("The reader opens the new topic dialog from the library"),
      overviewPicked: event("The reader ticks or unticks an unsorted overview to file under the new topic", {
        overviewId: OverviewId,
        picked: z.boolean(),
      }),
      created: event("The reader creates a topic from the library; never its name", {
        topicId: TopicId,
        filed: z.number().int().nonnegative(),
      }),
      cancelled: event("The reader closes the new topic dialog without creating one"),
    },
  },
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
      seePlusChosen: event("A reader on Free follows See Plus from the consent screen"),
      sessionRetried: event("The reader tries checking their account again on the consent screen"),
    },
    settingsConnections: {
      revoked: event("The reader revokes an assistant's access in Settings › Connections"),
      revokeAsked: event("The reader asks to revoke an assistant's access, before confirming"),
      revokeKept: event("The reader keeps an assistant's access after asking to revoke it"),
      addressCopied: event("The reader copies the connector address to give their assistant"),
      seePlusChosen: event("The reader on Free follows See Plus from Settings › Connections"),
      signInChosen: event("The reader follows Sign in from Settings › Connections"),
      createAccountChosen: event("The reader follows Create account from Settings › Connections"),
      retried: event("The reader tries loading their connections again"),
    },
  },
  timeSaved: {
    library: {
      breakdownOpened: event("The reader opens the time-saved breakdown from the library's running total"),
      breakdownClosed: event("The reader closes the time-saved breakdown"),
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
