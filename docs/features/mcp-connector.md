# The MCP connector

OV-26: a Plus reader connects Claude, or any other MCP client, to their account, and
the assistant reads their overviews and transcripts, and (OV-109) marks them read, unread
or favourite when the reader asks. The synthesis across many overviews happens in the
reader's own assistant, on their own plan. This server only serves the sources and keeps
the reader's marks.

It is built in three slices, one card and one PR each:

1. **OV-26, the authorization server**: client registration, authorize and consent, the
   code exchange, refresh, revoke, the reader's plan, and the API the consent screen and
   Settings will call.
2. **OV-57, the MCP endpoint and its tools**, on `/mcp`, resolving each request's bearer
   through `resolveAccessToken`.
3. **OV-58, the consent screen and the Settings section**, in the web app, once OV-51's
   Settings sections have landed.

This document describes all three as built, and the one tool that writes, added in OV-109.

## Why OAuth, and why its own tokens

`v1-architecture-decisions.md` said MCP would need OAuth 2.1 on top of magic-link accounts,
added alongside them. It is what MCP clients such as Claude's custom connectors speak:
they discover the server from metadata, register themselves, send the reader to
authorize, and hold tokens. None of that changes how a reader signs in. The authorize step
leads to a consent page that uses the reader's ordinary session, and the magic link is how
they get one if they have none.

**A connection's tokens are not sessions, and neither can stand in for the other.** They
live in `connection_tokens`, not `sessions`, and only `resolveAccessToken` reads them. The
session plugin never looks there, so an assistant's token opens nothing under `/api`, where
the sync API can write. Tests hold both directions. What a connection can do is therefore
exactly what the tools on `/mcp` do: read, and, under the write scope ("Scopes", below),
mark an overview read or favourite. There is no route that has to remember to check a scope
string; one place offers or withholds the one tool that writes.

## The routes

The protocol's routes sit at the root, outside `/api`. The callers are third-party
assistants that send none of our clients' headers (`X-Client-Version`, the session), and
they expect OAuth's own error shape, `{ "error": "invalid_grant", "error_description": … }`,
rather than our envelope. The reader's side lives under `/api` on the reader's own session,
like any other route, except reading a request, which a signed-out reader needs
("The consent screen", below).

| Route | Who calls it | What it does |
|---|---|---|
| `GET /.well-known/oauth-authorization-server` | assistant | RFC 8414 metadata: every endpoint, S256 only, the two scopes |
| `GET /.well-known/oauth-protected-resource[/mcp]` | assistant | RFC 9728: `/mcp` is guarded by this server. Both paths, because clients try both |
| `POST /oauth/register` | assistant | RFC 7591 dynamic registration, open |
| `GET /oauth/authorize` | reader's browser | checks the request and sends the reader to `/connect/<id>` |
| `POST /oauth/token` | assistant | `authorization_code` with PKCE, and `refresh_token` |
| `POST /oauth/revoke` | assistant | RFC 7009: either token ends the connection |
| `POST /mcp` | assistant | the MCP endpoint, on the connection's access token ("The endpoint", below) |
| `GET /api/oauth/requests/:id` | consent screen | who is asking and where they will send the reader. Public |
| `POST /api/oauth/requests/:id/decision` | consent screen | `{ approve }` gives `{ redirectTo }` |
| `GET /api/connections` | Settings | the reader's live connections |
| `DELETE /api/connections/:id` | Settings | revokes one, at once |

The issuer is `APP_URL`, since in production the API serves the web app from one origin
(`deploy.md`). In development, Vite proxies `/oauth`, `/.well-known/oauth-*` and `/mcp` to
the API as it already does `/api`, so the same holds on `localhost:5173`.

## Registering a client

Registration is open and needs no account, because that is how MCP clients expect to
arrive. A registered client is only a name and a list of places to send the reader back
to, and it can read nothing until a reader approves it. It is limited to 20 registrations
an hour per address, and rows no one ever authorizes are left for the same future sweep
as expired sessions.

**Redirect URIs are https, or plain http back to the caller's own machine** (`localhost`,
`127.0.0.1`, `[::1]`), and never carry a fragment or credentials. Custom schemes, which
some desktop clients use, are refused for now. Claude's connector returns to an https
address, and widening this later is one function (`isAllowedRedirectUri`).

**Public and confidential clients are both accepted.** A client that registers with
`token_endpoint_auth_method: none` proves nothing at the token endpoint, and PKCE does that
job. One that asks for `client_secret_post` or `client_secret_basic` is given a secret,
once, and only its hash is kept, like every other token here. It must present the secret
on every token and revoke call, and either transport is accepted.

## Authorizing

`/oauth/authorize` checks, in RFC 6749's order:

- **An unknown client, or a redirect it did not register, is shown to the reader as a
  plain 400 and never redirected.** Otherwise the endpoint would bounce a reader to any
  address the caller named.
- **Anything else wrong goes back to the client's own redirect as an error**, carrying its
  `state` and the `iss` parameter (RFC 9207). That covers a response type other than
  `code`, PKCE missing or not S256, a scope outside `overviews:read` and `overviews:write`
  ("Scopes", below), and a `resource` (RFC 8707) other than this server's `/mcp`.

A good request becomes a row in `oauth_authorizations`, and the reader is sent to
`/connect/<id>`. The row lasts **thirty minutes**, long enough for a reader who is not
signed in to ask for a magic link, find it and come back (the link itself lasts fifteen).

**The consent decision is a write under `/api`**, so it needs `X-Client-Version`, which no
cross-site form can set. That header is what stops another site from approving on the
reader's behalf, exactly as it protects every other write (`sign-in.md`). A request can be
decided once: the update that records the decision only matches an undecided, unexpired
row.

## Plus

The card gates the connector on Plus. Until OV-18 this used to be impossible, because a
plan was only a local setting (`plus-upsell.md`) and the server had nothing to check.
`accounts.plan` now exists, defaults to `free`, and is set by hand:

```
task plan -- reader@example.com plus
```

**Until OV-18 ships, every account can connect.** Nothing can be bought, so the connector
could not be tested by anyone not set to Plus by hand. Every check below asks
`canConnectAssistant(plan)` in `@overview/domain`, which answers yes for any plan for now;
moving the connector back to Plus is that one function returning `plan === "plus"`, and
un-skipping the tests that say "until billing exists". A signed-out device still cannot
connect: approving needs a session.

OV-18's billing will write the same column. It is checked at three points, so that
leaving Plus cuts access off rather than waiting for a token to lapse:

- **Approving** answers `403 plan_required` to a free reader. The request stays open, so a
  reader who upgrades can come back and approve it. The consent screen knows the plan
  up front, from the session, so it can show the free-tier state rather than a button
  that fails.
- **The code exchange and every refresh** refuse with `invalid_grant` once the account is
  not Plus.
- **Every request** through `resolveAccessToken` joins the account and requires Plus.

`GET /api/session` carries the plan, and the clients read it there through `usePlan()`. A
device with no session is on Free: Plus belongs to an account. A signed-in device that has
not heard back, or could not ask, does not know its plan and says so ("Checking…",
"Couldn't check your plan", with Try again) rather than calling it Free, so an offline
Plus reader is never pitched Plus.

## Tokens

| | Lifetime | Why |
|---|---|---|
| Authorization request | 30 minutes | a reader may need to sign in by email first |
| Code | 1 minute | an assistant exchanges it at once. OAuth recommends ten at most |
| Access token | 1 hour | short, because it is a bearer that sits in someone else's system |
| Refresh token | 30 days, renewed on each use | a connection used within a month stays connected, like a session |

All of them are opaque 256-bit tokens, handed out once, with only their SHA-256 kept.

**Refresh tokens rotate, and a reused one revokes the connection.** OAuth 2.1 requires
public clients' refresh tokens to be sender-constrained or rotated, and rotating needs
nothing from the client. A spent refresh token is kept until it expires, so that when it is
presented again (which means it was copied) the whole connection is deleted, and both
the thief and the rightful holder must reconnect. A code exchanged twice is treated the
same way, and the connection its first exchange made is deleted.

**Revoking means deleting the connection.** Its tokens cascade with it, so the reader's
revoke in Settings, the assistant's own revoke, and the replay cases all cut access on
the very next request. There is no revoked flag for a lookup to forget to check.
`connections.last_used_at` is touched at most once an hour, as sessions are, so Settings
can say when a connection was last used.

## Scopes

There are two, and the metadata lists both:

| Scope | Lets the connection | Held by |
|---|---|---|
| `overviews:read` | read overviews, topics, tags and transcripts: the six reading tools | every connection |
| `overviews:write` | mark overviews read, unread or favourite: `mark_overviews` | a connection that asked for it, or named no scope |

**Every connection reads**, since that is what connecting is, so a request for
`overviews:write` alone is granted both. **A request that names no scope is granted
both**, which is what a client that follows the metadata does. **A request for
`overviews:read` alone is honoured as read-only**, and that is what every connection made
before OV-109 holds, since `overviews:read` was then the only scope. A scope outside the
two is `invalid_scope`. The granted scope is stored on the authorization and copied to the
connection, and the token response names it. `grantedScope` and `connectionWrites` in
`connectionScope.ts` are the whole rule.

**The consent screen says what was asked.** `GET /api/oauth/requests/:id` carries
`writes`, and the permissions card lists marking as granted, and "Not change, add or
delete an overview" as withheld, only when it is; a read-only request shows the original
three lines, with "Change nothing. Access is read-only". The heading still says "wants to
read your overviews" in both cases, since reading is what every connection does.

**A read-only connection is not offered the write tool.** `tools/list` leaves
`mark_overviews` out, and `initialize` says in its instructions that the connection was
approved to read only and that reconnecting it from Settings › Connections lets the
assistant mark overviews, so the assistant can tell the reader rather than silently lacking
the tool ("Degrade visibly", `CLAUDE.md`). A call to it anyway is a failed call saying the
same. Reconnecting means revoking in Settings and connecting again from the assistant,
which asks the current metadata's scopes; there is no in-place upgrade of a connection's
scope, which would need a consent screen of its own.

## The endpoint

`/mcp` speaks MCP's Streamable HTTP transport, **statelessly**: every message is a `POST`,
every request is answered with one JSON body, and no session id is issued. The server has
nothing to say unasked, so it opens no stream: `GET` and `DELETE` answer `405`, a
notification or a client's response is accepted with `202`, and JSON-RPC batches are
refused. It speaks protocol versions `2025-11-25`, `2025-06-18` and `2025-03-26`, agrees
the client's at `initialize` when it knows it and offers its own latest otherwise, and
answers `400` to an `MCP-Protocol-Version` header it does not speak.

**There is no MCP SDK.** The official one brings Express, Hono and a dozen other packages
to serve what here is six methods (`initialize`, `ping`, `tools/list`, `tools/call`,
`prompts/list`, `prompts/get`). Written directly, the endpoint sits inside Fastify's own
hooks, so the bearer check and the rate limits run the way they do everywhere else, and
zod, already here, writes each tool's JSON Schema.

In order, a request meets:

1. **The per-address limit**, as on every route.
2. **The bearer**, through `resolveAccessToken`, which also requires Plus. A missing,
   unknown, expired or lapsed token is `401` with
   `WWW-Authenticate: Bearer resource_metadata="<APP_URL>/.well-known/oauth-protected-resource/mcp", scope="overviews:read overviews:write"`,
   plus `error="invalid_token"` when a token was sent. A reader's session token is not an
   access token and gets the same answer.
3. **`mcpAccount`**, 120 a minute per account, shared by all of a reader's assistants.
4. **The origin.** A request that carries an `Origin` other than `APP_URL` is `403`, which
   is the DNS-rebinding check MCP asks of every server. Claude calls from its servers and
   sends none.

Errors outside a tool's own work are JSON-RPC errors: a malformed body is `-32700` or
`-32600`, an unknown method `-32601`, and an unknown tool or prompt `-32602`. **A tool
that is called with arguments that do not fit, or that finds nothing, answers as a failed
call** (`isError: true`) with a sentence saying why, so the assistant reads it and tries
again rather than seeing a protocol fault.

## The tools

Six read, and are marked `readOnlyHint`; one writes, and is marked as not read-only, not
destructive and idempotent. Each reads the account's live records afresh, so what an
assistant sees is what has reached the server through sync.

| Tool | Returns |
|---|---|
| `search_overviews` | a light listing, newest saved first: title, channel, verdict, topics, saved date, id, and the one-line premise to choose by. 50 a page |
| `list_topics` | every topic with how many overviews it holds, its id and description, and how many overviews are not filed |
| `list_tags` | every tag, the video's own and the reader's, with how many overviews carry it, most used first (OV-84) |
| `get_overview` | one note in full |
| `get_overviews` | many notes in full, chosen by `ids`, the search filters, or both. 10 a call |
| `get_transcript` | one video's transcript, by its overview's id |
| `mark_overviews` | marks up to 50 overviews, by id, read or unread and favourite or not; write scope only (OV-109) |

**The filters** `search_overviews` and `get_overviews` share are `query`, `topic` (a name
or an id), `tag` (the video's own or the reader's `userTags`), `verdict`, `dubious`,
`favourite`, `read`, and `savedFrom`/`savedTo` as inclusive days. A topic that does not
exist is a failed call that points at `list_topics`, rather than an empty result that
looks like an answer.

**A note is `overviewMarkdown(overview)`** from `@overview/domain`, behind two lines naming
its id and topics: title, channel, length and dates, the link and tags, then the reader's
own sections in their order, with "Why I saved it" first when there is one. Every chapter
and the watch-anyway range link to their moment in the video through
`youtubeTimestampUrl`, so an assistant can cite a point to the second it was made. The
spoken narration script is never served. The same function is what a future
copy-to-clipboard will use.

**A transcript is `transcriptPlainText`**, the text the reader's Copy and Export produce,
so a transcript reads the same wherever it is taken. It is the account's own copy, looked
up under the reader's account, and never another reader's even when both saved the same
video. A machine-heard transcript says so in its first line. `transcriptPlainText`,
`transcriptBlocks`, `formatClock`, `formatTimestamp`, `youtubeTimestampUrl` and
`buildSearchHaystack` moved from app-core to `@overview/domain` so the API could use them
unchanged.

**A record this server cannot read**, one written at a newer schema version or one that
no longer parses, is left out, and the listing and `get_overviews` say how many were.

### Marking overviews

`mark_overviews` takes `ids` (one to 50, as `search_overviews` gives them) and `read`,
`favourite` or both. It is by id only, never by filter: "mark everything under Finance
read" is a search and then a mark of what came back, so the assistant and the reader both
see what is about to change, and a filter that matched the whole library could not mark
it in one call.

**It writes the reader's own `overviewState` record, through the same `decideMerge` the
`PUT /api/overviews/:id/state` route uses**, with `DEFAULT_OVERVIEW_STATE` under an absent
record and the reader's `userTags` left as they were, so the mark reaches every device
through the changes feed like a mark made in the app. The server writes as itself
(`serverClientContext`: the current client version and schema versions), since an assistant
has no version to claim. **`updatedAt` is the server's clock.** The assistant is never
asked for the time (`CLAUDE.md`, "Never let a model count, measure or time anything").

**An overview already marked as asked is left alone** and reported as such, so the feed
never carries a change that changes nothing, the rule `sync-api.md` has for the state
route's empty patch. **An id not in this library**, another reader's included, is checked
against the account's own overviews before anything is written: alone it is a failed call
pointing at `search_overviews`, and beside the reader's own it is a note on an otherwise
successful call, as `get_overviews` reports one. A state record written by a newer app
than this server knows is the floor (`record_newer_than_client`), answered as a failed call
that says nothing was changed.

The reply names what was marked, by title, and what already was; it carries no ids
beyond the missing ones, since the assistant has them.

The **`compare_topic` prompt** asks the assistant to read everything under one topic with
`get_overviews`, following the cursor, and say where the videos agree, contradict each
other, and stand alone, citing each point to its moment. It is there so the use the
connector exists for can be found in a client that lists prompts.

## Search

**Filtering happens in memory, after each record is migrated and parsed.** A filter can
only be trusted on a record in the current shape, and SQL over stored bodies at several
schema versions would have to know every shape they have ever had. Each call reads the
account's overviews, their state and topics in one query. At a few hundred notes that is
cheap, and the card's `ILIKE` would only have narrowed what was then read anyway.

**A query matches when every word in it appears**, in any order, in the same haystack the
library's own search uses (`buildSearchHaystack`: title, channel, premise, claim, verdict
reasoning, selling, actions, key points and tags). The library matches the whole phrase,
because a reader types one. An assistant sends keywords.

**Paging is by offset.** The cursor is the position of the next result in the list as it
stands now, so a note saved between two calls can shift a page by one. For an assistant
reading a library, that is acceptable.

## The context budget

`get_overviews` returns at most **10 notes a call**. The five sample notes, served as
Markdown, measure 3.0–4.6 KB each (500–780 words, about 750–1,150 tokens), and none of
them has chapters. A chapter adds at most about 50 words, so a note with ten comes to
roughly 1.3–1.8k tokens. Claude Code warns when one tool result passes 10,000 tokens and
refuses past 25,000 (`MAX_MCP_OUTPUT_TOKENS`), so twenty a call, the first guess, would
break there. Ten sits near the warning with room to spare, and the cursor pages the rest.
Re-measure once real notes with chapters exist. Transcripts are never included.

## Logging

Logged, by id only: a client registered (its auth method), a connection made, a request
decided (approved or not), and a connection revoked, with who revoked it (`reader`,
`client`, or `replayed`). A client's name is set by the client and never logged, and no
token, code or verifier is ever logged.

Every tool call is logged as `mcp tool called` with the connection's id, the assistant
(`claude`, `chatgpt` or `other`, from the name it registered with by `mcpAssistant`, never
the name itself), the tool's name, how many overviews it returned or marked (for the four that
do), whether it failed, and how long it took. A mark also logs `record written` for each
state record it changed, as every write under `/api` does. These are logs, not analytics
events: the reader didn't do anything in the app (`docs/architecture/analytics.md`,
"Actions, not logs"). A tool that throws is logged at `error` as `mcp tool failed`, and the assistant is
told to try again. A query, a topic, a note's content and a transcript are never logged.

## The consent screen

`/connect/<id>` in the web app (`ConsentPage`, design 58a–58h), where `/oauth/authorize`
sends the reader's browser.

**The name is a claim and the address is the proof.** Registration is open, so a client
calls itself whatever it likes, and may give no name at all. The heading quotes the name
beside a line saying it is unchecked, or drops it ("An assistant wants to read your
overviews"), and never shows a logo or a tick. The permissions card lists what the request
asked for ("Scopes", above). The redirect host gets its own card above
the permissions and the buttons, because it is the one thing on the screen the assistant
cannot make up. A long name is cut at 60 characters on screen and kept whole in the
heading's accessible name, and it is always a text node, never markup.

**Reading a request needs no session.** A reader who arrives signed out sees who is asking
and where they would be sent before they sign in, so they know what the email is for. The
request id is an unguessable UUID, and what it shows (a name the assistant chose and the
host the assistant registered) is already the assistant's. Answering still needs the
session and `X-Client-Version`.

**Signing in comes back to the request.** The page asks for a magic link with
`returnTo: /connect/<id>`, and the link is `/sign-in?return=/connect/<id>#token=…`. Both ends
accept only a consent path (`isConsentPath`): the server refuses anything else with a 400,
and `SignInPage` ignores anything else and goes to the library as before. The request lasts
30 minutes and the link 15, so a reader who asks straight away has time to use it.

**A link opened on another device says so.** The device that answers is the one sent back to
the assistant, so a reader who starts in Claude on a laptop and opens the email on a phone
would connect the phone's browser. The waiting screen says to open the link on this device.
The page remembers, in this browser, which requests it asked a link for
(`consentLinksAskedStorage`); a sign-in link that lands on a request this browser never
asked about shows "Started on another device?" above the heading. That needs nothing from
the server.

**Both answers leave.** Approve and Decline each get `{ redirectTo }` and go there by a full
page load, so there is no result screen: the pressed button says where it is going
("Sending you back to claude.ai…"), both lock, and a status region reads the same. A free
reader has no Approve at all, only what Plus would do, how long the request stays open,
See Plus and Decline. An expired or answered request (`404 not_found`) is the error state
with no retry, since the only way forward is from the assistant.

## Settings › Connections

`/settings/connections` (`ConnectionsSection`, design 58i–58r), after API keys, shown
wherever the shell can sync. Its row reads "N connected" or "None" on Plus, "Needs Plus" on
Free, and "Sign in first" signed out, which is its own state rather than the Free one
because a connection belongs to an account.

The intro says an assistant can read the reader's overviews and transcripts and mark them
read or favourite; it does not say which a given connection holds. On Plus it lists each
connection by name ("No name given" when there is none), when it connected and when it
was last used. `last_used_at` is touched at most once an hour, so the
line says "Used in the last hour", "Used today" or "Last used 14 September", never minutes.
Below is the connector address (`<server>/mcp`, with Copy where the clipboard can be
written), three steps for Claude, and with nothing connected, three questions to try, one
of them across overviews. The Plus panel's MCP line links here.

**Revoke asks once.** It cannot be undone, so the row turns into a confirmation that says
so. Revoke access removes the row at once, sends the delete, and moves focus to the
Connected label; a refused delete puts the row back and says so. Keep it restores the row
with focus on its Revoke.

## Events

The design's five events are in the analytics catalogue under the app's own naming
(`docs/architecture/analytics.md`, "Naming"): `mcp.consentScreen.shown` once a request
has loaded, `mcp.consentScreen.plusRequired` once a reader on Free is shown the Plus card,
`mcp.consentScreen.approved`, and `mcp.consentScreen.declined` with the plan the reader was
on, both sent as the page is left so they outlive it, and `mcp.settingsConnections.revoked`
once the server has taken the revoke. Only a
signed-in reader is counted, so a request looked at before signing in is not; the server
still logs every decision and revoke itself, as above.

## Not built yet

- **CORS on the protocol routes.** Claude calls them from its servers. A browser-based
  client such as the MCP Inspector would need `/oauth/token`, `/oauth/register` and `/mcp`
  to answer cross-origin, and `/mcp` to accept its `Origin`. That is a list of origins
  added when one is wanted.
- **A sweep** of unused clients, lapsed authorization requests and expired tokens, which
  waits for the same future job as expired sessions (`api.md`).
- **Coming back after buying Plus.** The free consent state says, as design 58g does, that
  getting Plus brings the reader back to approve the request. See Plus opens the Plan
  section, which has nothing to buy yet; carrying the request through a purchase and back
  waits for billing (OV-18).
- **Other writes**: filing under a topic, tags, the capture reason. `mark_overviews` is
  the only tool that writes, and the write scope covers only marks; another kind of write
  would be another tool under the same scope, or a scope of its own if the reader should be
  able to allow one without the other.
- **Which scope a connection holds, in Settings.** A connection from before OV-109 is
  read-only and the row does not say so; the assistant says so when it is asked to mark.
- **Audio.** Narration is not exposed, and would wait for sync to carry it.
