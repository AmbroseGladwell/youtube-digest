# Account libraries

Until this card, each shell kept one IndexedDB database with a fixed name,
`overview-local-store`, whoever was signed in. After signing out the library was still
there, so the app looked signed in. On a shared device a second account signing in saw the
first account's overviews, and on its first sync it enrolled and pushed them into its own
account. And signing out mid-upload dropped what had not been sent: sign-out ended the
session first and then cleared the outbox.

The free tier was designed as fully local with no account
(`docs/architecture/v1-architecture-decisions.md`), and accounts came later, so "signed
out" meant two things: never had an account, and had one and left. This document is what
was decided for both (Trello OV-47, 2026-10-02) and what is built so far.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| A database per account, plus the no-account one under the name every install already has | `packages/store-local/src/localDatabaseName.ts` |
| Opening one library: the database and its four stores, closed as one | `packages/store-local/src/openLocalLibrary.ts`, with `openLocalLibrary.test.ts` |
| The sign-in answers name the account | `packages/domain/src`: `SignedIn.ts` (web), `LinkedSession.ts`; `apps/api/src/auth/authRoutes.ts` |
| The device remembers which account it is signed in to | `features/sync/types/SyncConnection.ts` (`accountId`, `libraryAccountIdOf`), `syncConnectionStorage.ts` (`readLibraryAccountId`) |
| The app follows the account, swapping libraries in place | `packages/app-core/src/stores/LibraryRuntime.tsx`, `Library.ts`, `LibraryAccountContext.ts` |
| Each shell opens the library the device was last signed in to | `apps/web/src/main.tsx`, `apps/extension/src/mountApp.tsx` |
| The extension's worker reads the same library as its pages | `apps/extension/src/libraryAccount.ts`, `serviceWorker.ts` |
| Sign-out waits for the cycle in flight and clears nothing | `features/sync/SyncRuntime.tsx` |
| Reading positions kept per library | `features/transcripts/readingPositionStorage.ts` |
| The screens, against in-memory libraries per account | `packages/app-core/playwright/iwft/scenarios/accountLibraries.iwft.ts` |

## The decisions

1. **One database per account, plus a no-account one.** `overview-local-store` is the
   no-account library, and each account gets `overview-account-<accountId>`. Signing out
   switches to the no-account library; signing in switches to that account's, which then
   syncs. Clearing one database on sign-out was rejected because it takes the free
   reader's library with it, and only labelling the library because it does not stop the
   leak between accounts.
2. **An account's library stays on the device after sign-out**, with its outbox, revisions
   and cursor. Signing back in resumes: queued writes push, then the feed is pulled from
   where it stopped, so nothing is downloaded twice and nothing queued is dropped. The cost,
   accepted: on a shared device the account's overviews stay readable in that browser
   profile's storage, though never in the app.
3. **Sign-out syncs first, and never blocks.** It runs a cycle, ends the server session,
   then switches library. Writes still queued after that (offline, failed, parked) stay in
   the account's library for its next sign-in on this device, and the reader is told.
4. **The conflict rules are unchanged.** `decideMerge` and `decideReplace` stay as
   `sync-api.md` has them: field writes commute across fields, and on one field the write to
   reach the server last wins. A write queued at sign-out and pushed weeks later can
   therefore overwrite a newer edit made elsewhere to the same field. That needs a sign-out
   that could not sync, the same field edited elsewhere, and a sign-in on the old device,
   and a device left signed in but offline for weeks has the same exposure already.
5. **An install signed in when this lands attaches its database to that account**, copied
   with its outbox into `overview-account-<id>`; the no-account library starts empty. A
   signed-out install keeps its database as the no-account library.
6. **Signing in moves the no-account library into the account, without asking**, and says
   so afterwards. The records are journalled into the account's library and removed from
   the no-account one, so nothing is duplicated.
7. **One overview per video.** Where the account already holds an overview of a video the
   no-account library also has, the account's copy is kept and the device's is not moved,
   and the reader is told how many. The move waits for the first pull, so "already holds"
   means what the account holds, not what this device happened to have.
8. **Switching account is signing out and then in.** An account's library never shows
   another account's records. The one thing that crosses is the no-account library, which
   joins whoever signs in next; it belongs to whoever uses the device without signing in.

## Why the swap happens in place

`LibraryRuntime` sits inside the query client and above everything that reads a store. It
watches the connection; when the account it implies differs from the open library's, it
asks the shell to open the other one, swaps it into `StoresProvider`, resets every query so
each page reads again from the new stores, and only then closes the old database.

It swaps rather than remounting the app because a sign-in happens in the middle of a
screen. The extension's code exchange ends on "You're in, Ada", local state of a page the
connection change would otherwise throw away. The router is a module-level object either
way, so the reader stays where they were.

**Sync runs only on the account's own library.** The connection changes the moment a
sign-in answers, and the account's library opens a moment later. In between, the stores
are still the library being left, and an engine started on them would enrol it and push
it into the account: the very leak this card closes. So `SyncRuntime` treats the device as
unable to sync until the open library is the connection's, and
`accountLibraries.iwft.ts` checks that the no-account library is never enrolled.

**A web sign-in lands only once the account's library is open.** Signing in can finish
something the visitor started on a shared page: saving its copy, or generating from its
link (`docs/features/sharing.md`). Done the moment the connection changed, that would go
into the library being left. So `SignInPage` holds the landing until the open library is
the account's, and then finishes it and navigates.

Which library to open is a fact about the connection, `libraryAccountIdOf`: the account
when a server is known, the no-account library when none is. A connection stored before
`accountId` existed reads back with none, and opens `overview-local-store` as it always
did; decision 5 is what moves it.

**The extension's worker cannot read `localStorage`**, and it opens the library itself to
answer whether a video is held (`docs/features/injected-button.md`). So each extension
page writes the account of the library it opened to `chrome.storage.local`, and the worker
opens the database that names. A change to it re-broadcasts every button's state, because
signing in or out changes which overviews are held.

## Sign-out

It stops the engine, waits for a cycle already running to finish, tells the server, and
then clears the connection, which is what switches the library. Nothing in the account's
database is cleared: `IndexedDbSyncStorage.leave()` is no longer called on sign-out. Before
this, sign-out ended the session first, so a push in flight could be refused, and then
cleared the outbox, losing the writes it held. A push the server accepted but whose
acknowledgement never landed stays queued and is sent again at the next sign-in; every
route takes a resend as the same write (`sync-client.md`, "What stops a cycle and what parks
a write").

## Departures, recorded

- **`SyncState.disconnect` is gone.** It existed so sign-out could forget the bookkeeping,
  which is exactly what sign-out must now not do, and nothing else called it.
- **`accountId` is required on both sign-in answers.** The server ships before any client
  that reads it, as the web app ships in the same image and the extension is built against
  the deployed server.

## Not built yet

This card is built as stacked PRs, data first and screens once their designs exist (designs
47a–47f on the card).

- Decision 3's sync before signing out, and the notice of what is still queued.
- Decision 5's migration of an install signed in when this lands. Until it lands, such an
  install keeps reading `overview-local-store` while signed in.
- Decisions 6 and 7: the move on sign-in, one per video, and its notice. Until then, a new
  sign-in opens an empty account library and the no-account library waits where it is.
- The signed-out library's own states (47a, 47b), the switching state (47f), and the copy on
  the sign-in and Settings pages.
