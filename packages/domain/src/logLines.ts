export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

export type LogFields = object;

export interface LogLineDeclaration {
  level: LogLevel;
  message: string;
  description: string;
}

export interface CodedLogMessage {
  logCode: string;
  msg: string;
}

export interface LogLine extends LogLineDeclaration {
  logCode: string;
  (fields?: LogFields): CodedLogMessage;
}

export type LogLineAreas = Record<string, Record<string, LogLineDeclaration>>;

export type CodedLines<A extends LogLineAreas> = {
  [Area in keyof A]: { [Event in keyof A[Area]]: LogLine };
};

const line = (level: LogLevel, message: string, description: string): LogLineDeclaration => ({
  level,
  message,
  description,
});

const codedLine = (logCode: string, declaration: LogLineDeclaration): LogLine =>
  Object.assign((fields: LogFields = {}) => ({ ...fields, logCode, msg: declaration.message }), { ...declaration, logCode });

// The code is the line's position here: docs/architecture/errors-and-logs.md, "Logging codes".
const coded = <A extends LogLineAreas>(service: string, areas: A): CodedLines<A> =>
  Object.fromEntries(
    Object.entries(areas).map(([area, events]) => [
      area,
      Object.fromEntries(
        Object.entries(events).map(([event, declaration]) => [event, codedLine(`${service}.${area}.${event}`, declaration)]),
      ),
    ]),
  ) as CodedLines<A>;

// PostHog filters match the service.area.event code; the message may be reworded.
export const apiLogLines = coded("api", {
  http: {
    requestReceived: line("info", "incoming request", "A call arrived, by method and route. The bulk of all log volume."),
    requestCompleted: line("info", "request completed", "The same call answered, by status and how long it took."),
    requestRefused: line("warn", "request refused", "An ApiError or a 4xx Fastify raised, with its code and status."),
    throttled: line("warn", "throttled", "A rate limit turned a call away; `limit` names which one."),
    unhandledError: line("error", "unhandled error", "A 500 nothing planned for, reported to error tracking as well."),
    requestErrored: line("error", "request errored", "The response itself failed, after the route had answered."),
    errorHandled: line("error", "error handled", "Fastify's own error handler answered, where one of ours had not."),
    routeNotFound: line("info", "route not found", "A call arrived for a method and path no route matches."),
    streamClosedPrematurely: line(
      "info",
      "stream closed prematurely",
      "The caller went away while a streamed response was still being written.",
    ),
    responseTerminated: line("warn", "response terminated", "A stream failed with the headers already sent, so nothing could be said."),
    serializerFailed: line("error", "serializer failed", "The serializer for a status code threw; `statusCode` says which."),
    writeHeadFailed: line("warn", "write head failed", "Writing the response head threw while an error was being answered."),
    serverClosing: line("info", "request aborted", "A call arrived while the server was closing and was refused with a 503."),
  },
  startup: {
    databaseReachable: line(
      "info",
      "database reachable",
      "The first query at startup answered, before migrations and before the port opens.",
    ),
    databaseUnreachable: line(
      "fatal",
      "database unreachable",
      "The first query at startup failed; the process exits and the machine never reports live.",
    ),
    migrationsApplied: line("info", "migrations applied", "Which migrations ran as the server came up."),
    duplicateOverviewsFolded: line("info", "duplicate overviews folded", "A migration folded two overviews of one video together."),
    magicLinks: line("info", "magic links", "The mail transport sign-in links go through, and the app URL they open."),
    narration: line("info", "narration", "The TTS service and audio store in use, or why narration is unavailable."),
    transcriptService: line("info", "transcript service", "Whether the server fetches transcripts itself, and through which proxy."),
    speechToText: line(
      "info",
      "speech to text",
      "Whether episodes with no transcript can be transcribed on the GPU host, and at which host.",
    ),
    ourKey: line("info", "our key", "Whether overviews can be made on our key, on which model, and the global daily cap."),
    playlists: line("info", "playlists", "Whether a YouTube key is set, so playlists can be followed."),
    tiktok: line(
      "info",
      "tiktok",
      "Whether the ScrapeCreators key is set, so our server can read TikTok links; without it /api/tiktok says it is unavailable.",
    ),
    social: line(
      "info",
      "social posts",
      "Whether the ScrapeCreators key is set, so our server can read Instagram and Facebook links; without it /api/social says it is unavailable.",
    ),
    podcastLookups: line(
      "info",
      "podcast lookups",
      "Which directory a Spotify link's show is looked up in first, and whether our server can search YouTube for an episode.",
    ),
    analytics: line("info", "analytics", "Where events and errors are passed on to, or that they are only logged."),
    accountErasure: line("info", "account erasure", "Whether a deleted account's events and errors can be erased at PostHog, or why not."),
    webApp: line("info", "web app", "Whether this process serves the web app as well as the API."),
    logShipping: line("info", "log shipping", "Where these logs are shipped, or that they go to stdout only."),
  },
  db: {
    slowQuery: line("warn", "slow query", "A query at or over SLOW_QUERY_MS, with its statement and never its parameters."),
    slowTransaction: line("warn", "slow transaction", "A whole transaction at or over SLOW_QUERY_MS."),
    connectionLost: line("error", "database connection lost", "The pool's error event, for an idle connection the database dropped."),
  },
  process: {
    uncaughtException: line("fatal", "uncaught exception", "An exception nothing caught; the process stops after reporting it."),
    unhandledRejection: line("fatal", "unhandled rejection", "A rejected promise nothing caught; the process stops after reporting it."),
  },
  sync: {
    recordWritten: line("info", "record written", "A record reached the server, at which seq and from which session."),
    recordAlreadyDeleted: line("info", "record already deleted", "A delete retried after it was already done."),
    changesServed: line("info", "changes served", "A device pulled a page of changes; `next` is how far it got."),
  },
  audio: {
    requested: line("info", "audio requested", "A reader asked for narration, and what was already stored for that key."),
    queued: line("info", "audio queued", "Nothing was stored, so a render went on the queue."),
    dailyCapSpent: line("warn", "audio daily cap spent", "An account asked for a new render past its daily cap; nothing was queued."),
    rendered: line("info", "audio rendered", "A render came back from the TTS service and was stored."),
    renderFailed: line("warn", "audio render failed", "A render failed with attempts left; it will be tried again."),
    renderGaveUp: line("error", "audio render gave up", "A render failed past MAX_RENDER_ATTEMPTS and will not be retried."),
    workerStopped: line("error", "audio worker stopped", "A queue worker threw and stopped taking jobs."),
    deleted: line("info", "audio deleted", "Stored narration was removed."),
    segmentsSwept: line(
      "info",
      "audio segments swept",
      "Streamed segments kept for first plays were deleted once SEGMENTS_KEPT_MS had passed.",
    ),
  },
  speech: {
    played: line(
      "info",
      "chat answer read aloud",
      "A chat answer went through the live lane: plan, voice, how many sentences and chunks, how many chunks were spoken, skipped after a failure or dropped when the reader stopped (`stopped`), whether the machine was started cold, the wait for the first slot, seconds to the first audio, machine seconds charged, the usage it spent (`usageUnits`) and whether a price was set (`priced`). Never the text.",
    ),
    warmed: line(
      "info",
      "speech warmed",
      "A reader showed they might listen: whether a machine was started (`warmed`), the machine seconds charged and the usage it spent.",
    ),
    allowanceSpent: line("info", "speech allowance spent", "Read aloud was refused because the month's or day's chat usage was spent."),
    chargeFailed: line("error", "speech charge failed", "A finished play's usage or cost couldn't be written."),
  },
  auth: {
    magicLinkSent: line("info", "magic link sent", "A sign-in link went out. Never the address, the link or its token."),
    magicLinkHeldBack: line("warn", "magic link held back", "A second link asked for inside the cooldown, answered as if sent."),
    noAccountMailed: line(
      "info",
      "no account mailed",
      "A sign-in was asked for an address with no account; it was told so by mail, and no link went out.",
    ),
    signedIn: line("info", "signed in", "An existing account used a link."),
    accountCreated: line("info", "account created", "A link created an account that did not exist."),
    signInRefused: line("warn", "sign-in refused", "A sign-in link was used for an address with no account; nothing was made."),
    sessionCreated: line("info", "session created", "A device signed in; each device gets its own session."),
    signedOut: line("info", "signed out", "A session ended, under the account and session that held it."),
    linkCodeIssued: line("info", "link code issued", "A code was minted to carry a session to the extension."),
    anonymousIdLinked: line("info", "anonymous id linked", "A new account was joined to the events it sent before signing up."),
    anonymousIdNotLinked: line("warn", "anonymous id not linked", "That join failed; the account's earlier events stay separate."),
    nameChanged: line("info", "name changed", "A reader set, changed or cleared their first name; `cleared` says which."),
    verificationAsked: line(
      "info",
      "verification asked",
      "A code went to the account's own address before a sensitive change; `fresh` when the session was young enough to skip it.",
    ),
    verificationHeldBack: line("warn", "verification held back", "A second code asked for inside the cooldown, answered as if sent."),
    verificationConfirmed: line("info", "verification confirmed", "The session proved its inbox and is verified for a while."),
    emailChangeAsked: line(
      "info",
      "email change asked",
      "A code went to a new address, or the mail saying it already has an account; never which, nor the address.",
    ),
    emailChangeHeldBack: line("warn", "email change held back", "A second code asked for inside the cooldown, answered as if sent."),
    emailChangeConfirmed: line("info", "email change confirmed", "An account moved to a new address, and the old one was told."),
    emailChangeReverted: line("info", "email change reverted", "The old address moved the account back and every session ended."),
    emailChangeRevertRefused: line("warn", "email change revert refused", "A revert link could not act; `reason` says why."),
    accountDeleted: line(
      "info",
      "account deleted",
      "An account and every row under it are gone; `narration`, `postHogAccount` and `postHogAnonymous` say how each later step ended. Never the address.",
    ),
    accountDeletionStepFailed: line(
      "error",
      "account deletion step failed",
      "A step after the commit failed; `step` names it, and `task api:finish-deletions` retries it (docs/features/account-deletion.md).",
    ),
    accountDeletionFinished: line("info", "account deletion finished", "A retry finished the steps a deletion had left unfinished."),
  },
  meaning: {
    embedded: line(
      "info",
      "overview embedded",
      "An overview's claims were embedded, with how many were new, how many were reused and the tokens the new ones cost.",
    ),
    embedFailed: line("warn", "overview embedding failed", "Embedding an overview failed with attempts left; it will be tried again."),
    embedGaveUp: line(
      "error",
      "overview embedding gave up",
      "Embedding failed past MAX_EMBED_ATTEMPTS, or the record could not be read; nothing retries until the overview changes.",
    ),
    removed: line("info", "embeddings removed", "Embeddings of overviews that were deleted were dropped."),
    workerStopped: line("error", "embedding worker stopped", "The embedding worker threw and stopped taking overviews."),
    searched: line(
      "info",
      "meaning searched",
      "A search looked for overviews by meaning: where from, how many matched by word, how many more only by meaning, and whether meaning was available. Never the query.",
    ),
  },
  mcp: {
    connectionRequestDecided: line(
      "info",
      "connection request decided",
      "A reader approved or declined an assistant's request to connect.",
    ),
    connectionMade: line("info", "connection made", "An assistant exchanged its grant for a token."),
    connectionRevoked: line("info", "connection revoked", "A connection ended, by the reader, by the client, or on a replayed grant."),
    oauthClientRegistered: line("info", "oauth client registered", "An assistant registered itself before asking to connect."),
    toolCalled: line("info", "mcp tool called", "An assistant called a tool, with the tool, whether it failed and how long it took."),
    toolFailed: line("error", "mcp tool failed", "A tool threw rather than returning an error to the assistant."),
  },
  transcripts: {
    served: line("info", "transcript served", "An account's own transcript was handed back to it. Never the video id or a word of it."),
    stored: line("info", "transcript stored", "A client's transcript was kept as its account's own copy."),
    notKept: line("warn", "transcript not kept", "A client's transcript was taken but not kept: no note of the account's uses it."),
    refused: line("warn", "transcript refused", "A transcript failed its checks; `fault` says which."),
    forgotten: line("info", "transcripts forgotten", "Transcripts were dropped with the overview they belonged to."),
    searched: line(
      "info",
      "transcripts searched",
      "A search looked for words said in the reader's transcripts: where from (`app` or `mcp`) and how many overviews matched. Never the query.",
    ),
  },
  captures: {
    saved: line(
      "info",
      "capture saved",
      "A source was saved without its overview and counted against the month's saves; `used` and `limit`.",
    ),
    saveLimitReached: line(
      "warn",
      "capture save limit reached",
      "A save without an overview was refused: the month's saves are used. `plan` and `limit`.",
    ),
    claimExpired: line(
      "info",
      "capture claim expired",
      "A device took over a source whose claim had run out without being released: the device making it closed or lost its connection.",
    ),
    claimedElsewhere: line(
      "info",
      "capture claimed elsewhere",
      "A device asked to make a queued source another device of the account is already making.",
    ),
    superseded: line("info", "captures superseded", "An overview took its source's capture with it; `count` says how many went."),
  },
  serviceTranscripts: {
    fetched: line("info", "service transcript fetched", "Our own server fetched captions, direct or through the proxy."),
    failed: line("warn", "service transcript failed", "That fetch failed; `failure` names the kind."),
    refused: line("warn", "service transcript refused", "YouTube answered with captions that could not be read."),
    quotaSpent: line("warn", "service transcript quota spent", "A caller hit the daily safety cap on server-side fetches."),
    overviewsSpent: line(
      "warn",
      "service transcript refused for spent overviews",
      "An account asked with no overview left this month on either key.",
    ),
    fetchedForSave: line(
      "info",
      "service transcript fetched for a save",
      "With no overview left this month, a fetch went ahead for a save without an overview; `savesLeft` is what remained.",
    ),
    proxySpend: line("info", "transcript proxy spend", "Bytes billed to the residential proxy, and the day's running total."),
  },
  costs: {
    notRecorded: line(
      "error",
      "cost not recorded",
      "A call's cost couldn't be written against its account; the reader's request carried on, and that cost is missing from unit economics.",
    ),
  },
  ourKey: {
    generated: line(
      "info",
      "overview made on our key",
      "An overview made on our key: plan, model, the note kind its check chose, tokens (input counts cache reads and writes), cost in dollars over every attempt, the month's count and how long it took.",
    ),
    failed: line(
      "warn",
      "overview on our key failed",
      "A generation on our key failed and its slots were given back; `noteKind` is the kind its check chose (null if it never answered), `reason` says why, `fallback` whether it may move to the next key, and the tokens and cost of the attempts the provider still billed.",
    ),
    smallPass: line(
      "info",
      "small pass on our key",
      "A profile, For anyone, topic or topic-suggestion pass on our key: which, the cost in dollars and how long it took. It doesn't count against the plan.",
    ),
    smallPassFailed: line(
      "warn",
      "small pass on our key failed",
      "A profile, For anyone, topic or topic-suggestion pass on our key failed; the reader's overview isn't affected. Carries the cost of the attempts the provider still billed.",
    ),
    quotaSpent: line("info", "our key quota spent", "An account asked for an overview on our key with none left this month."),
    dailyCapSpent: line("warn", "our key daily cap spent", "The global daily cap on our key refused a generation for every plan."),
    keyRefused: line("error", "our key refused", "The provider refused our own key. Every generation on our key fails until it is fixed."),
  },
  chat: {
    answered: line(
      "info",
      "chat answered",
      "A chat question answered on our key: plan, model, tokens (input counts cache reads), the cached share, cost in dollars, whether the source covered it, whether the answer added general knowledge beyond the source, how many citations of the source, of the overview, of other chats and of other overviews, how many other chats' messages went with it, whether search ran and how many other overviews this question added (pinned, found, in brief) or set aside, and, for a library or project chat, its `owner`, whether its overviews went `whole` or by the `map`, how many it `picked` and the picking pass's tokens, the plan's `answerMode` (`deep` or `broad`), whether it `filtered`, how many overviews it was `lookedAcross` and how many of those the answer cited (`scopeCited`), and how many `sections` and `points` the answer has, whether the reader's profile went with it (`personalised`), the usage it spent (`usageUnits`, OV-376), the month's usage before it (`used`) against its allowance (`limit`), in units, and how long it took. Never the question, the answer or the profile.",
    ),
    failed: line(
      "warn",
      "chat answer failed",
      "A chat question on our key failed and its allowance was given back; `reason` says why (`EmptyAnswerError` when the reply had no answer), with the tokens and cost the provider still billed.",
    ),
    stopped: line(
      "info",
      "chat answer stopped",
      "The reader stopped an answer, or left, before it was stored: nothing was stored and the question was given back. The tokens already billed aren't known, since the provider reports them only at the end.",
    ),
    retried: line(
      "info",
      "chat provider retried",
      "The provider refused a chat question for now (`status`) and it was asked again after a wait.",
    ),
    keywordSearchFailed: line(
      "warn",
      "chat keyword search failed",
      "Searching the account's transcripts for a question's words failed (`reason`), so the answer went on without minutes from other transcripts.",
    ),
    allowanceSpent: line(
      "info",
      "chat allowance spent",
      "An account asked a chat question with this month's or today's usage spent, or too little left for a library question (`quota`: `month`, `month-library` or `day`), with `used` and `limit` in usage units (OV-376).",
    ),
    dailyCapSpent: line(
      "warn",
      "chat daily cap spent",
      "The global daily cap on chat messages on our key refused a question for every plan.",
    ),
  },
  trials: {
    issued: line(
      "info",
      "trial token issued",
      "A signed-out device was given a trial token, to read its onboarding link and ask for topic suggestions.",
    ),
    topicSuggestionsUnknownTrial: line(
      "warn",
      "topic suggestions refused for an unknown trial",
      "Onboarding asked for topic suggestions with a trial token this server never issued, so the device will ask for a new one. Never the token or the address.",
    ),
  },
  reservations: {
    reserved: line(
      "info",
      "own-key overview reserved",
      "A device reserved a slot on the reader's own key before generating: plan, the month's count and limit.",
    ),
    released: line("info", "own-key reservation released", "A generation on the reader's own key failed, and its slot was given back."),
    quotaSpent: line("info", "own key quota spent", "An account asked to reserve an overview on its own key with none left this month."),
    shareSaved: line("info", "shared overview saved", "A reader saved a shared overview into their library. It is not counted."),
    pushRefused: line(
      "warn",
      "new overview pushed without a reservation",
      "A reserving client pushed a new overview the server has no reservation or our-key generation for.",
    ),
  },
  shares: {
    created: line("info", "share created", "A reader made a share link. Never the token or anything from the note."),
    revoked: line("info", "share revoked", "A reader withdrew a share link."),
    viewed: line("info", "share viewed", "A share page was opened. Nothing about the viewer is logged."),
    pageMissing: line("info", "share page missing", "A share page was asked for that is unknown or revoked."),
    sampleMissing: line("warn", "sample missing", "A sample in SAMPLE_SHARE_TOKENS isn't a live share, so Start doesn't offer it."),
  },
  analytics: {
    clientEvent: line("info", "client event", "One checked analytics event, logged as well as passed on to PostHog."),
    clientEventsDropped: line("warn", "client events dropped", "The client's own queue dropped events, so a gap reads as lost data."),
    clientEventsRefused: line(
      "warn",
      "client events refused",
      "Events the catalogue does not have, or with properties it does not declare.",
    ),
    clientEventsNotForwarded: line("warn", "client events not forwarded", "PostHog was slow or down. The reader never sees this."),
    clientEventsDroppedForOptOut: line(
      "info",
      "client events dropped for opt-out",
      "An account's devices still sent events after it opted out.",
    ),
    declined: line("info", "analytics declined", "A reader without an account said no to analytics."),
  },
  errors: {
    clientError: line("warn", "client error", "An error reported from a shell, with the id of the call that failed."),
    clientWarning: line("warn", "client warning", "A degraded moment the app carried on through; logged, never an issue."),
    clientErrorsDropped: line("warn", "client errors dropped", "The reporter's own queue dropped reports."),
    clientErrorsNotForwarded: line("warn", "client errors not forwarded", "Error tracking was slow or down."),
    serverErrorNotForwarded: line("warn", "server error not forwarded", "One of our own errors could not be passed on to error tracking."),
  },
  client: {
    captureTimed: line(
      "info",
      "capture timed",
      "How a capture's time split on the device: each step asked, its outcome and its milliseconds. Measured by the app, never estimated; logged, never an event.",
    ),
  },
  settings: {
    analyticsOptOutSet: line("info", "analytics opt-out set", "A reader turned sharing on or off in Settings."),
    profileSharingSet: line(
      "info",
      "profile sharing set",
      "A reader let connected assistants read what is known about them, or stopped them. Never the profile.",
    ),
    narrationVoiceChosen: line("info", "narration voice chosen", "A reader picked a different narration voice."),
    themeChosen: line("info", "theme chosen", "A reader chose System, Light or Dark."),
    accentColourChosen: line("info", "accent colour chosen", "A reader chose an accent colour."),
    headImageSizeChosen: line("info", "head image size chosen", "A reader chose Small or Full width for the image at the top of a note."),
    timeSavedMilestonesChanged: line("info", "time-saved milestones changed", "A reader changed which milestones they are shown."),
  },
  articles: {
    read: line("info", "article read", "A pasted link was fetched, and how that went; `outcome` is the reason it failed. Never the link."),
    trialReadsSpent: line("warn", "trial reads spent", "A signed-out device asked to read another link after its trial's reads were used."),
    trialReadAddressSpent: line(
      "warn",
      "trial read address cap spent",
      "An address read its links for the day without an account, across every token. Never the address.",
    ),
  },
  podcasts: {
    read: line(
      "info",
      "podcast episode read",
      "A podcast link was turned into an episode from its feed, and how that went; `linkFrom` is the platform, `outcome` the reason it failed. Never the link.",
    ),
    transcript: line(
      "info",
      "podcast transcript resolved",
      "A podcast episode's transcript was asked for; `via` is the rung that answered (remembered, tag, youtube), `from` where a remembered source was, and `format` the tag's, or `failure` why none could. Never the feed or the episode, and the words are never kept.",
    ),
    checked: line(
      "info",
      "podcast transcript checked",
      "Whether an episode's words could be found was asked before Create, fetching none; `words` is found, none or unknown, `via` the rung that said so, `offer` what transcribing would mean, and `ms` how long it took. Never the feed or the episode.",
    ),
    youTubeSearched: line(
      "info",
      "podcast episode searched on youtube",
      "Our server looked for an episode on its show's YouTube channel through the Data API; `units` is what it cost in the daily quota, `searches` the calls from search's own smaller allowance, and `found` whether it matched. Never the show or the episode.",
    ),
  },
  tiktok: {
    read: line(
      "info",
      "tiktok video read",
      "A TikTok link was turned into a video and its words through the vendor; `link` is the link's shape (video, short), `outcome` read or why not, `captions` how many caption tracks it has, `segments` how many lines of words came back (0 with no captions), `credits` what the vendor charged and `vendorStatus` its answer when it failed. Never the link, the handle, the video or the words.",
    ),
  },
  social: {
    read: line(
      "info",
      "social post read",
      "An Instagram or Facebook link was turned into a post through the vendor; `platform` is instagram or facebook, `link` the link's shape (post, share), `outcome` read or why not, `media` video, photo or text, `segments` how many lines of a Facebook video's captions came back, `credits` what the vendor charged and `vendorStatus` its answer when it failed. Never the link, the account, the description or the words.",
    ),
  },
  transcription: {
    requested: line(
      "info",
      "episode transcription requested",
      "A reader asked for an episode with no transcript to be transcribed from its audio; `caller` is account or address, `episodeSeconds` the feed's length and `reservedSeconds` what was held against the month's allowance. Never the feed, the episode or the audio's address.",
    ),
    refused: line(
      "info",
      "episode transcription refused",
      "A transcription wasn't started; `reason` is `allowance` (the month's hours are spent), `too-long` or `no-audio`, with `usedSeconds` and `limitSeconds` for the first.",
    ),
    started: line(
      "info",
      "episode transcription started",
      "A GPU started on an episode; `waitedSeconds` is from the request to the worker's start, the time a reader spent waiting for a card.",
    ),
    finished: line(
      "info",
      "episode transcribed",
      "An episode's words came back; `audioSeconds` measured, `workerSeconds` billed, `gpu`, `cold`, `language`, `dollars` at the host's list price and `requestToReadySeconds` end to end. The words are never logged.",
    ),
    failed: line(
      "warn",
      "episode transcription failed",
      "A transcription ended without words; `reason` is the failure a reader is shown and `detail` the worker's own code. Its held seconds are given back.",
    ),
    workerStopped: line("error", "transcription worker stopped", "A transcription worker hit an error outside any one job and stopped."),
  },
  videos: {
    read: line(
      "info",
      "video read",
      "A video link was read for its card before anything was written; `outcome` is why it failed, `noteKind` what the check found. Never the link.",
    ),
    signedOutKindChecksSpent: line(
      "warn",
      "signed-out kind checks spent",
      "The day's kind checks before an account were used up, so the video was read without one.",
    ),
  },
  playlists: {
    read: line("info", "playlist read", "A followed playlist was read, and what it cost in YouTube quota units."),
    unavailable: line("info", "playlist unavailable", "A playlist could not be read; `reason` says why."),
  },
  questions: {
    refreshed: line(
      "info",
      "suggested questions refreshed",
      "The Ask page asked for suggested questions: the plan, `status` (`started`, or what stopped it: `free`, `busy`, `not-due`, `capped`), and once a started refresh ends its `outcome` (`written`, `full`, `no-pairs`), whether it filled the library (`library`), how many projects (`projects`), how many pairs it labelled and how many questions it wrote. Never a question, a title or an id.",
    ),
    refreshFailed: line(
      "warn",
      "suggested question refresh failed",
      "A started refresh threw after the Ask page had its answer; `reason` names the error class, with the pairs labelled before it. Nothing it had not written is kept.",
    ),
  },
  feedback: {
    received: line(
      "info",
      "feedback received",
      "A reader sent feedback: the plan, `surface`, `kind` (`wrong`, `idea` or none), whether it came from an overview, and how many recent actions came with it. Never the text or the overview's id.",
    ),
  },
  seed: {
    narrationUnavailable: line("info", "no voice samples to seed", "The release command found no TTS service, so it rendered no samples."),
    voiceSamplesSeeded: line("info", "voice samples seeded", "The release command queued a sample render for each voice that lacked one."),
    voiceSamplesReady: line("info", "voice samples ready", "How many voices have a playable sample after the deploy, and which do not."),
  },
  logs: {
    recordsDropped: line("warn", "log records dropped", "The log exporter's own buffer overflowed or a batch was refused."),
  },
});

export const API_LOG_LINES: readonly LogLine[] = Object.values(apiLogLines).flatMap((area) => Object.values(area));
