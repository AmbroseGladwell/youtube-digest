# The MCP connector

OV-26: a Plus reader connects Claude, or any other MCP client, to their account, and
the assistant reads their overviews and transcripts. The synthesis across many overviews
happens in the reader's own assistant, on their own plan. This server only serves the
sources.

It is built in three slices, one PR each:

1. **The authorization server** (this document, as built): client registration, authorize
   and consent, the code exchange, refresh, revoke, the reader's plan, and the API
   the consent screen and Settings will call.
2. **The MCP endpoint and its tools**, on `/mcp`, resolving each request's bearer through
   `resolveAccessToken`.
3. **The consent screen and the Settings section**, in the web app, once OV-51's
   Settings sections have landed.

Until the second slice lands, a connection can be made but reads nothing. Until the third,
the consent page an assistant is sent to (`/connect/<id>`) is not drawn yet.

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
the sync API can write. Tests hold both directions. A connection is read-only because the
only thing that honours its token will be the MCP endpoint, and every tool there reads.
That is a stronger guarantee than a scope string that each route has to remember to check.

## The routes

The protocol's routes sit at the root, outside `/api`. The callers are third-party
assistants that send none of our clients' headers (`X-Client-Version`, the session), and
they expect OAuth's own error shape, `{ "error": "invalid_grant", "error_description": … }`,
rather than our envelope. The reader's side lives under `/api` on the reader's own session,
like any other route.

| Route | Who calls it | What it does |
|---|---|---|
| `GET /.well-known/oauth-authorization-server` | assistant | RFC 8414 metadata: every endpoint, S256 only, the one scope |
| `GET /.well-known/oauth-protected-resource[/mcp]` | assistant | RFC 9728: `/mcp` is guarded by this server. Both paths, because clients try both |
| `POST /oauth/register` | assistant | RFC 7591 dynamic registration, open |
| `GET /oauth/authorize` | reader's browser | checks the request and sends the reader to `/connect/<id>` |
| `POST /oauth/token` | assistant | `authorization_code` with PKCE, and `refresh_token` |
| `POST /oauth/revoke` | assistant | RFC 7009: either token ends the connection |
| `GET /api/oauth/requests/:id` | consent screen | who is asking, where they will send the reader, the reader's plan |
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
  `code`, PKCE missing or not S256, a scope other than `overviews:read`, and a `resource`
  (RFC 8707) other than this server's `/mcp`.

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

OV-18's billing will write the same column. It is checked at three points, so that
leaving Plus cuts access off rather than waiting for a token to lapse:

- **Approving** answers `403 plan_required` to a free reader. The request stays open, so a
  reader who upgrades can come back and approve it. The consent screen is told the plan
  up front, so it can show the free-tier state rather than a button that fails.
- **The code exchange and every refresh** refuse with `invalid_grant` once the account is
  not Plus.
- **Every request** through `resolveAccessToken` joins the account and requires Plus.

The web app still reads its plan from `Settings.plan` through `usePlan()`. Moving that to
`GET /api/session` belongs to the Settings slice, where the consent screen and the
connection section first need it.

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

## Logging

Logged, by id only: a client registered (its auth method), a connection made, a request
decided (approved or not), and a connection revoked, with who revoked it (`reader`,
`client`, or `replayed`). A client's name is set by the client and never logged, and no
token, code or verifier is ever logged. The MCP endpoint's own logging (tool calls by name
and how many overviews each returned) arrives with the second slice.

## Not built in this slice

- **CORS on the protocol routes.** Claude calls them from its servers. A browser-based
  client such as the MCP Inspector would need `/oauth/token` and `/oauth/register` to
  answer cross-origin, and that is a list of origins added when one is wanted.
- **A sweep** of unused clients, lapsed authorization requests and expired tokens, which
  waits for the same future job as expired sessions (`api.md`).
- **The MCP endpoint, the consent page and Settings**: slices two and three.
