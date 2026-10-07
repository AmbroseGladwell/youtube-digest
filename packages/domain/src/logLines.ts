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
    migrationsApplied: line("info", "migrations applied", "Which migrations ran as the server came up."),
    duplicateOverviewsFolded: line("info", "duplicate overviews folded", "A migration folded two overviews of one video together."),
    magicLinks: line("info", "magic links", "The mail transport sign-in links go through, and the app URL they open."),
    narration: line("info", "narration", "The TTS service and audio store in use, or why narration is unavailable."),
    transcriptService: line("info", "transcript service", "Whether the server fetches transcripts itself, and through which proxy."),
    playlists: line("info", "playlists", "Whether a YouTube key is set, so playlists can be followed."),
    analytics: line("info", "analytics", "Where events and errors are passed on to, or that they are only logged."),
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
    rendered: line("info", "audio rendered", "A render came back from the TTS service and was stored."),
    renderFailed: line("warn", "audio render failed", "A render failed with attempts left; it will be tried again."),
    renderGaveUp: line("error", "audio render gave up", "A render failed past MAX_RENDER_ATTEMPTS and will not be retried."),
    workerStopped: line("error", "audio worker stopped", "A queue worker threw and stopped taking jobs."),
    deleted: line("info", "audio deleted", "Stored narration was removed."),
  },
  auth: {
    magicLinkSent: line("info", "magic link sent", "A sign-in link went out. Never the address, the link or its token."),
    magicLinkHeldBack: line("warn", "magic link held back", "A second link asked for inside the cooldown, answered as if sent."),
    signedIn: line("info", "signed in", "An existing account used a link."),
    accountCreated: line("info", "account created", "A link created an account that did not exist."),
    sessionCreated: line("info", "session created", "A device signed in; each device gets its own session."),
    signedOut: line("info", "signed out", "A session ended, under the account and session that held it."),
    linkCodeIssued: line("info", "link code issued", "A code was minted to carry a session to the extension."),
    anonymousIdLinked: line("info", "anonymous id linked", "A new account was joined to the events it sent before signing up."),
    anonymousIdNotLinked: line("warn", "anonymous id not linked", "That join failed; the account's earlier events stay separate."),
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
    proxySpend: line("info", "transcript proxy spend", "Bytes billed to the residential proxy, and the day's running total."),
    answeredFromCache: line("info", "service transcript answered from the shared cache", "No fetch was needed; the cache already had it."),
  },
  shares: {
    created: line("info", "share created", "A reader made a share link. Never the token or anything from the note."),
    revoked: line("info", "share revoked", "A reader withdrew a share link."),
    viewed: line("info", "share viewed", "A share page was opened. Nothing about the viewer is logged."),
    pageMissing: line("info", "share page missing", "A share page was asked for that is unknown or revoked."),
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
  settings: {
    analyticsOptOutSet: line("info", "analytics opt-out set", "A reader turned sharing on or off in Settings."),
    narrationVoiceChosen: line("info", "narration voice chosen", "A reader picked a different narration voice."),
    timeSavedMilestonesChanged: line("info", "time-saved milestones changed", "A reader changed which milestones they are shown."),
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
