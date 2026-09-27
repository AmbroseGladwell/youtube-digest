# Sign-in

Until this slice, a session was real but the only way to get one was a token pasted
from the command line, so nobody but the person running the server could sign in.
`docs/architecture/api.md` named what was missing: a `magic_links` table, two auth
endpoints, a cookie transport for the web app, a link-code exchange for the extension,
and a transactional email provider. This is all five, and where the build departs from
the names that document gave them, it says so.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Hashed one-time links, fifteen minutes, one per address per minute | `apps/api/migrations/V0003__magic_links_and_link_codes.sql`, `src/auth/issueMagicLink.ts`, `consumeMagicLink.ts` |
| The link points at the web app, with the token in the fragment | `packages/domain/src/signInLink.ts` |
| Three public routes: ask, sign in, exchange | `apps/api/src/auth/authRoutes.ts` |
| The cookie transport, as a second way onto the same `sessions` row | `src/auth/sessionCookie.ts`, `sessionPlugin.ts`, `sessionRoutes.ts` |
| Link codes: eight characters, no look-alikes, ten minutes, once | `src/auth/linkCode.ts`, `issueLinkCode.ts`, `consumeLinkCode.ts` |
| The mailer behind one interface: Brevo in production, the log in development | `src/mail/` |
| The wire shapes the two sides share, and the one new error code | `packages/domain/src`: `AuthSurface.ts`, `MagicLinkRequest.ts`, `SignInRequest.ts`, `SignedIn.ts`, `LinkCodeRequest.ts`, `LinkedSession.ts`, `SessionInfo.ts`, `ApiErrorCode.ts` |
| The auth client, beside the sync client, over one shared requester | `packages/sync/src`: `apiRequest.ts`, `fetchAuthApi.ts`, `AuthApi.ts` |
| Where a link lands | `packages/app-core/src/features/auth/SignInPage/` |
| The settings panel: email in, then the code in the extension | `features/sync/components/SyncPanel/` |
| Sign-out, and a connection that may hold no token | `features/sync/SyncRuntime.tsx`, `types/SyncConnection.ts` |
| The routes through the whole app over PGlite | `apps/api/src/auth/authRoutes.test.ts` |
| The screens, in a browser, against a simulated server | `packages/app-core/playwright/iwft/scenarios/signIn.iwft.ts`, `sync.iwft.ts` |

## The flow, on each shell

**On the web.** Settings asks for an email and nothing else, because the API is the
page's own origin. `POST /api/auth/magic-link` answers `202` whether or not the address
has an account, and the mail carries one link. Opening it lands on `/sign-in` in the web
app, which posts the token to `POST /api/auth/sign-in`; the answer sets the session
cookie and the page goes to Settings, which now says who is signed in. From then on
every sync call carries the cookie and no header.

**In the extension.** The panel is another origin, so no cookie the API sets can reach
it, and the link opens in a browser tab rather than in the panel. So the panel asks for
the server's address and an email, and the link it gets is marked as asked for from the
extension. Opening it lands on the same `/sign-in` page, which posts the same token and
gets back not a session but a **link code**, eight characters shown large. The reader
types the code into the panel, the panel posts it to `POST /api/auth/link-code`, and
the answer is the panel's own bearer token, stored where the pasted one used to be.

**The tab that opened an extension link is not signed in.** It would cost nothing to set
the cookie as well, and it was decided against: the web app being signed in enrols and
pushes its whole local library to the account, which is a thing the reader did not ask
for by clicking a link in their mail on behalf of the extension. One link signs in the
one shell that asked. The page says so.

## Decisions, and why

**The link is consumed by a POST from the page, not by the GET that opens it.**
`api.md` named `GET /api/auth/callback?token=`. A GET that signs in is spent by the first
mail scanner that follows the link before the reader does, which corporate mail does as
a matter of course. So the link opens the web app, and the app's own script makes the
request that spends the token. The route is `POST /api/auth/sign-in`; the callback name
went with the method.

**The token rides in the fragment.** `/sign-in#token=…` rather than `?token=`: a
fragment is never sent to the server, so the process that serves the page never sees
the token in a request line, a log, or a `Referer`. `signInLink` and
`signInTokenFromHash` in `@overview/domain` are the pair that agree on this, and
`Routes.signIn()` is built from the same constant so the path cannot drift.

**Asking makes no account; only a consumed link does.** An address anyone can type into
a public form is not evidence of anything. `magic_links` stores the address, and the
account row is created by the sign-in that proved it, through the same
`findOrCreateAccount` the CLI uses.

**One link per address per minute, and the answer does not change.** There is no rate
limiter yet, and a public endpoint that sends mail is otherwise a way to fill someone's
inbox. Inside the cooldown the request is answered `202` exactly as if a link had gone,
and nothing is sent. The first link is still live, so the reader loses nothing.

**Only hashes are stored**, for the link token and for the code, the same way as for
the session token, and by the same `hashToken`. A database read is not a sign-in.

**Consuming is one statement.** `update … where token_hash = $1 and consumed_at is null
and expires_at > $2 returning …`: two clicks on the same link cannot both sign in,
because the second finds no row to update, with no transaction to reason about.

**Spent, expired and unknown are one answer**, `410 link_invalid`, for the link and for
the code. The reader has one thing to do in all three cases, ask again, and a prober
learns nothing from the difference. `410` because the thing being asked about did exist
and no longer does, which is closer than `404` and not a `401`: the request carried no
credential to be wrong about.

**The cookie.** `overview_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age`
equal to the session's life, `Secure` when `APP_URL` is https, which is everywhere but
`localhost`. It carries the same opaque token a bearer would, onto the same row: the
plugin looks for a bearer first and the cookie only in its absence, which is what
`api.md` meant by "`bearerToken` is the one function that grows a fallback", except
that the fallback grew beside it rather than inside it. When a cookie session slides,
the cookie is re-issued with the new life, so the sliding expiry the server promises
is one the browser actually keeps. `DELETE /api/session` clears it.

**Cross-site writes are refused by a rule that already existed.** Every write needs
`X-Client-Version`, a header a cross-site form cannot set, so a forged POST with the
cookie attached is a `400` before it reaches a handler. `authRoutes.test.ts` asserts it
on `DELETE /api/session` rather than leaving it to be remembered. The CORS allowlist is
unchanged and still never `*`; `api.md` said the cookie is the day that would matter,
and this is that day.

**Link codes are typed, so they are made to be typed.** Eight characters from an alphabet
with no `0`, `O`, `1`, `I` or `L`, shown as `XXXX-XXXX`, accepted in any case with any
separators or none. Ten minutes and once. Forty bits, one-time and short-lived, is
enough with no rate limiter: a guess is one HTTP request and the code is dead in ten
minutes either way.

**The mailer is one interface with three implementations.** Brevo in production over
its one HTTP call, with no SDK to depend on; the server's own log in development, so a
first day needs no mail account and the link is one line of output away; and a
recording one in tests. Brevo was chosen for its free tier of three hundred mails a day,
which covers a single reader many times over, and a first paid tier that is cheap if it
ever needs more. `MAIL_FROM` is written the way a mail client shows a sender,
`The Overview <signin@example.com>`, and `parseMailSender` takes it apart for Brevo's
`sender` object. Nothing but `createMailer` knows which transport is in use.

**Configuration refuses the combinations that would silently fail.** `MAIL_TRANSPORT`
defaults to `log`. With `brevo`, a missing key or sender is refused at startup, and so
is an `APP_URL` that is not https, because real mail to a real address must carry a
link that opens. `APP_URL` defaults to `http://localhost:5173`, which is where
`task run` puts the web app, and is the one origin the cookie is allowed to be
`Secure`-less on.

## What the reader sees

Every screen follows the third habit in `CLAUDE.md`: a control appears only where it can
work.

**Settings, signed out.** On the web: an email field and `Email me a link`, then
`Check your email` with the address it went to and a way to use a different one. In the
extension: the server's address, the email, and below them the code field with
`Connect`, which is always there because the panel may have been closed and reopened
between asking and getting the code, and asking again inside the minute sends nothing.

**Settings, signed in.** `Signed in as …`, the one status line sync already had,
`Sync now` and `Sign out`. When the server no longer knows the session the line says
`Sign in again` and the button does.

**The sign-in page.** `Signing you in…` for the moment it takes; then either Settings, or
the code with a line saying this tab stays signed out and why; or the dead-end screen
with the way back, `Go to Settings`, where a new link can be asked for. A `/sign-in`
with no token in it says so rather than guessing.

**Sign-out** tells the server and then disconnects whether or not it answered. A session
the server could not be told about ends on its own within thirty days; this device is
done with it either way, and reporting "could not sign out" for a token the device has
already forgotten would be a control with nothing behind it.

## Departures, recorded

- **`POST /api/auth/sign-in`, not `GET /api/auth/callback`.** Above. `api.md`'s
  sentence naming the callback is corrected.
- **The extension's tab is not signed in.** Above; not argued anywhere before.
- **`SyncConnection` gained `email` and lost the rule that a token is required.** A
  connection is a server; the token is the extension's session and the web app has
  none to hold. A connection stored before this slice reads back with no email.
- **`hashSessionToken` and `generateSessionToken` are `hashToken` and `generateToken`.**
  Three things are hashed now and the name was a lie for two of them.

## Not built

Rate limiting beyond the per-address cooldown; a sweep of spent links and codes, which
is the same later cron as the session sweep; changing the email on an account; the web
app minting a link code for an extension already signed in beside it, which would save
one email and is a small addition to `authRoutes` when it is wanted; and serving the
SPA from the API, without which `/sign-in` in production is wherever the web app is
deployed, named by `APP_URL`.
