export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

export type LogFields = object;

export interface LogLineDeclaration {
  level: LogLevel;
  message: string;
  description: string;
}

export interface LogLine extends LogLineDeclaration {
  logCode: string;
  (fields?: LogFields): { logCode: string; msg: string };
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

// The code is the line's position in this tree, so it can't drift from where it is declared
// (docs/architecture/errors-and-logs.md, "Logging codes").
const coded = <A extends LogLineAreas>(service: string, areas: A): CodedLines<A> =>
  Object.fromEntries(
    Object.entries(areas).map(([area, events]) => [
      area,
      Object.fromEntries(
        Object.entries(events).map(([event, declaration]) => [event, codedLine(`${service}.${area}.${event}`, declaration)]),
      ),
    ]),
  ) as CodedLines<A>;

// Every line the API can write, by `service.area.event`, the way analytics events are
// `feature.screen.action` (docs/architecture/analytics.md, "Naming"). The code is what a
// PostHog filter matches; the message is prose and may be reworded without breaking it.
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
    streamClosedPrematurely: line("info", "stream closed prematurely", "The caller went away while a streamed response was still being written."),
    responseTerminated: line("warn", "response terminated", "A stream failed with the headers already sent, so nothing could be said."),
    serializerFailed: line("error", "serializer failed", "The serializer for a status code threw; `statusCode` says which."),
    writeHeadFailed: line("warn", "write head failed", "Writing the response head threw while an error was being answered."),
    serverClosing: line("info", "request aborted", "A call arrived while the server was closing and was refused with a 503."),
  },
  startup: {
    databaseReachable: line("info", "database reachable", "The first query at startup answered, before migrations and before the port opens."),
    databaseUnreachable: line("fatal", "database unreachable", "The first query at startup failed; the process exits and the machine never reports live."),
    migrationsApplied: line("info", "migrations applied", "Which migrations ran as the server came up."),
    duplicateOverviewsFolded: line("info", "duplicate overviews folded", "A migration folded two overviews of one video together."),
    magicLinks: line("info", "magic links", "The mail transport sign-in links go through, and the app URL they open."),
    narration: line("info", "narration", "The TTS service and audio store in use, or why narration is unavailable."),
    transcriptService: line("info", "transcript service", "Whether the server fetches transcripts itself, and through which proxy."),
    ourKey: line("info", "our key", "Whether overviews can be made on our key, on which model, and the global daily cap."),
    playlists: line("info", "playlists", "Whether a YouTube key is set, so playlists can be followed."),
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
  },
  auth: {
    magicLinkSent: line("info", "magic link sent", "A sign-in link went out. Never the address, the link or its token."),
    magicLinkHeldBack: line("warn", "magic link held back", "A second link asked for inside the cooldown, answered as if sent."),
    noAccountMailed: line("info", "no account mailed", "A sign-in was asked for an address with no account; it was told so by mail, and no link went out."),
    signedIn: line("info", "signed in", "An existing account used a link."),
    accountCreated: line("info", "account created", "A link created an account that did not exist."),
    signInRefused: line("warn", "sign-in refused", "A sign-in link was used for an address with no account; nothing was made."),
    sessionCreated: line("info", "session created", "A device signed in; each device gets its own session."),
    signedOut: line("info", "signed out", "A session ended, under the account and session that held it."),
    linkCodeIssued: line("info", "link code issued", "A code was minted to carry a session to the extension."),
    anonymousIdLinked: line("info", "anonymous id linked", "A new account was joined to the events it sent before signing up."),
    anonymousIdNotLinked: line("warn", "anonymous id not linked", "That join failed; the account's earlier events stay separate."),
    nameChanged: line("info", "name changed", "A reader set, changed or cleared their first name; `cleared` says which."),
    verificationAsked: line("info", "verification asked", "A code went to the account's own address before a sensitive change; `fresh` when the session was young enough to skip it."),
    verificationHeldBack: line("warn", "verification held back", "A second code asked for inside the cooldown, answered as if sent."),
    verificationConfirmed: line("info", "verification confirmed", "The session proved its inbox and is verified for a while."),
    emailChangeAsked: line("info", "email change asked", "A code went to a new address, or the mail saying it already has an account; never which, nor the address."),
    emailChangeHeldBack: line("warn", "email change held back", "A second code asked for inside the cooldown, answered as if sent."),
    emailChangeConfirmed: line("info", "email change confirmed", "An account moved to a new address, and the old one was told."),
    emailChangeReverted: line("info", "email change reverted", "The old address moved the account back and every session ended."),
    emailChangeRevertRefused: line("warn", "email change revert refused", "A revert link could not act; `reason` says why."),
    accountDeleted: line("info", "account deleted", "An account and every row under it are gone; `narration`, `postHogAccount` and `postHogAnonymous` say how each later step ended. Never the address."),
    accountDeletionStepFailed: line("error", "account deletion step failed", "A step after the commit failed; `step` names it, and `task api:finish-deletions` retries it (docs/features/account-deletion.md)."),
    accountDeletionFinished: line("info", "account deletion finished", "A retry finished the steps a deletion had left unfinished."),
  },
  mcp: {
    connectionRequestDecided: line("info", "connection request decided", "A reader approved or declined an assistant's request to connect."),
    connectionMade: line("info", "connection made", "An assistant exchanged its grant for a token."),
    connectionRevoked: line("info", "connection revoked", "A connection ended, by the reader, by the client, or on a replayed grant."),
    oauthClientRegistered: line("info", "oauth client registered", "An assistant registered itself before asking to connect."),
    toolCalled: line("info", "mcp tool called", "An assistant called a tool, with the tool, whether it failed and how long it took."),
    toolFailed: line("error", "mcp tool failed", "A tool threw rather than returning an error to the assistant."),
  },
  transcripts: {
    served: line("info", "transcript served", "A cached transcript was handed back. Never the video id or a word of it."),
    stored: line("info", "transcript stored", "A client's transcript went into the shared cache."),
    notKept: line("warn", "transcript not kept", "A client's transcript was taken but not cached."),
    refused: line("warn", "transcript refused", "A transcript failed its checks; `fault` says which."),
    sharedRead: line("info", "shared transcript read", "The shared cache was asked for a transcript; `hit` says whether it had one."),
    forgotten: line("info", "transcripts forgotten", "Transcripts were dropped with the overview they belonged to."),
  },
  serviceTranscripts: {
    fetched: line("info", "service transcript fetched", "Our own server fetched captions, direct or through the proxy."),
    failed: line("warn", "service transcript failed", "That fetch failed; `failure` names the kind."),
    refused: line("warn", "service transcript refused", "YouTube answered with captions that could not be read."),
    quotaSpent: line("warn", "service transcript quota spent", "A caller hit the daily safety cap on server-side fetches."),
    overviewsSpent: line("warn", "service transcript refused for spent overviews", "An account asked with no overview left this month on either key."),
    trialSpent: line("warn", "service transcript refused for a spent trial", "A signed-out device asked after its onboarding overview on our key was made."),
    proxySpend: line("info", "transcript proxy spend", "Bytes billed to the residential proxy, and the day's running total."),
    answeredFromCache: line("info", "service transcript answered from the shared cache", "No fetch was needed; the cache already had it."),
  },
  ourKey: {
    generated: line("info", "overview made on our key", "An overview made on our key: plan, model, tokens, cost in dollars, the month's count and how long it took."),
    failed: line("warn", "overview on our key failed", "A generation on our key failed and its slots were given back; `reason` says why, `fallback` whether it may move to the next key."),
    smallPass: line("info", "small pass on our key", "A profile, For anyone, topic or topic-suggestion pass on our key: which, the cost in dollars and how long it took. It doesn't count against the plan."),
    smallPassFailed: line("warn", "small pass on our key failed", "A profile, For anyone, topic or topic-suggestion pass on our key failed; the reader's overview isn't affected."),
    quotaSpent: line("info", "our key quota spent", "An account asked for an overview on our key with none left this month."),
    dailyCapSpent: line("warn", "our key daily cap spent", "The global daily cap on our key refused a generation for every plan."),
    signedOutShareSpent: line("warn", "our key signed-out share spent", "The signed-out share of the global daily cap refused a trial overview; accounts carry on."),
    trialSpent: line("info", "trial spent on our key", "A signed-out device asked for another overview on our key after its onboarding one."),
    trialAddressSpent: line("warn", "trial address cap spent", "An address made its 3 onboarding overviews on our key today, across every token. Never the address."),
    keyRefused: line("error", "our key refused", "The provider refused our own key. Every generation on our key fails until it is fixed."),
  },
  trials: {
    issued: line("info", "trial token issued", "A signed-out device was given a trial token before its onboarding overview on our key."),
    topicSuggestionsUnknownTrial: line("warn", "topic suggestions refused for an unknown trial", "Onboarding asked for topic suggestions with a trial token this server never issued, so the device will ask for a new one. Never the token or the address."),
  },
  reservations: {
    reserved: line("info", "own-key overview reserved", "A device reserved a slot on the reader's own key before generating: plan, the month's count and limit."),
    released: line("info", "own-key reservation released", "A generation on the reader's own key failed, and its slot was given back."),
    quotaSpent: line("info", "own key quota spent", "An account asked to reserve an overview on its own key with none left this month."),
    movedFromTrial: line("info", "trial overview moved in on our key", "An overview made on our key in a signed-out trial was moved into an account, and counted on its month on our key."),
    shareSaved: line("info", "shared overview saved", "A reader saved a shared overview into their library. It is not counted."),
    pushRefused: line("warn", "new overview pushed without a reservation", "A reserving client pushed a new overview the server has no reservation or our-key generation for."),
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
    clientEventsRefused: line("warn", "client events refused", "Events the catalogue does not have, or with properties it does not declare."),
    clientEventsNotForwarded: line("warn", "client events not forwarded", "PostHog was slow or down. The reader never sees this."),
    clientEventsDroppedForOptOut: line("info", "client events dropped for opt-out", "An account's devices still sent events after it opted out."),
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
    captureTimed: line("info", "capture timed", "How a capture's time split on the device: each step asked, its outcome and its milliseconds. Measured by the app, never estimated; logged, never an event."),
  },
  settings: {
    analyticsOptOutSet: line("info", "analytics opt-out set", "A reader turned sharing on or off in Settings."),
    profileSharingSet: line("info", "profile sharing set", "A reader let connected assistants read what is known about them, or stopped them. Never the profile."),
    narrationVoiceChosen: line("info", "narration voice chosen", "A reader picked a different narration voice."),
    themeChosen: line("info", "theme chosen", "A reader chose System, Light or Dark."),
    accentColourChosen: line("info", "accent colour chosen", "A reader chose an accent colour."),
    headImageSizeChosen: line("info", "head image size chosen", "A reader chose Small or Full width for the image at the top of a note."),
    timeSavedMilestonesChanged: line("info", "time-saved milestones changed", "A reader changed which milestones they are shown."),
  },
  articles: {
    read: line("info", "article read", "A pasted link was fetched, and how that went; `outcome` is the reason it failed. Never the link."),
    trialReadsSpent: line("warn", "trial reads spent", "A signed-out device asked to read another link after its trial's reads were used."),
    trialReadAddressSpent: line("warn", "trial read address cap spent", "An address read its links for the day without an account, across every token. Never the address."),
  },
  playlists: {
    read: line("info", "playlist read", "A followed playlist was read, and what it cost in YouTube quota units."),
    unavailable: line("info", "playlist unavailable", "A playlist could not be read; `reason` says why."),
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
