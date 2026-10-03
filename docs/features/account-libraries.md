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
| Sign-out syncs first, for ten seconds at most, and clears nothing | `features/sync/SyncRuntime.tsx` |
| What a sign-out left queued, counted and worded | `features/sync/util/signOutOutcomeOf.ts`, `signOutNoticeFor.ts`, `features/accountLibraries/util/signOutNoticeCopy.ts` |
| Sign-out counted before the session ends | `features/accountLibraries/useSignOut.ts`, `account.*` in `packages/domain/src/analyticsEvents.ts` |
| What the device remembers: signed out here, offer turned down | `features/accountLibraries/deviceAccountHistoryStorage.ts`, `useDeviceAccountHistory.ts` |
| The strips (47a, 47c), the signed-out library (47b), the notice (47d), opening (47f) | `features/accountLibraries/components/` |
| Which strip shows, and when the device counts as signed out here | `features/accountLibraries/useAccountStripKind.ts`, `useSignedOutHere.ts` |
| Settings' row and section (47g), the sign-in page's line (47h) | `features/settings/util/settingsRowValues.ts`, `features/sync/components/SyncPanel/`, `features/auth/util/savedOverviewsNote.ts` |
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

It runs one sync cycle, so whatever was waiting goes before the session does, then stops
the engine, tells the server, and clears the connection, which is what switches the
library. Nothing in the account's database is cleared: `IndexedDbSyncStorage.leave()` is no
longer called on sign-out. Before this, sign-out ended the session first, so a push in
flight could be refused, and then cleared the outbox, losing the writes it held. A push the
server accepted but whose acknowledgement never landed stays queued and is sent again at the
next sign-in; every route takes a resend as the same write (`sync-client.md`, "What stops a
cycle and what parks a write").

**It always completes.** A cycle that hangs is given up on after ten seconds rather than
holding the reader signed in, and an offline device goes at once, since its cycle stops as
`offline`. While it runs, Sign out reads "Syncing before you sign out…" in place, in the
menu (which stays open) and in Settings (47d-1); there is no dialog and no Cancel.

**Then it says what it couldn't send.** If the last cycle left writes queued or parked, a
notice floats over the page (47d-2): how many will sync at the next sign-in here, with the
reason first when the device was offline (47d-3), and parked writes on their own line in
warning ink, since nothing will send them. It is polite, never takes focus, and stays until
dismissed or until the next sign-in. With nothing left, there is nothing to say.

**A sign-in that lands meanwhile wins.** Sign-out clears the connection only if it is still
the one it set out to sign out, so a sign-in finished during its last cycle is not undone.

## What signed out looks like

Two flags, kept on the device whoever is signed in (`DeviceAccountHistory`): whether an
account has ever signed out here, written by sign-out and cleared by sign-in, and whether
the offer of an account was turned down. A reader who has never had an account is told
nothing about signing out, ever.

- **Signed out, holding overviews (47a).** A stone strip in the generation strip's slot,
  "Signed out. Sign in to sync your Overviews…", with Sign in and no ×: it lasts as long as
  the state does. The subtitle says "in this browser", and the account button's name says
  "Account, signed out". In the panel the strip sits above the offer.
- **Signed out, holding nothing (47b).** Not a route: the library at / when it is empty and
  the flag is set. It leads with what is safe, shows no address, and takes focus on its
  heading. Below Sign in, the first-run field, so someone else at a shared device can start;
  it is shown only when this device can generate, like every control here. The panel says
  it in one line under its offer.
- **Never signed in (47c).** Once the library holds an overview, the same slot offers an
  account, "Sync across devices…", with Create account and ×, which hides it on this device
  for good. The empty first-run page doesn't carry it: it has one job, taking a link, and a
  reader with nothing yet has nothing to sync. The same goes for the panel.
- **Opening (47f).** After a sign-in, until the account's first cycle is done, the library
  is its own skeleton with "Opening your library…", so an empty library is never taken for
  the account's. Sign-out needs none: the device's own library opens at once.
- **Settings (47g).** Signed out here, the account row reads "Signed out · saved in this
  browser", and the section says how many Overviews are only saved here, with Sign in and
  Create account. A device that never had an account keeps the old copy.
- **The sign-in page (47h)** says signing in adds what is here "except any for videos it
  already has". Creating an account is unchanged: a new account holds nothing to clash with.

The strips show only on the library, where what they describe is in front of the reader,
and give way to the generation strip while something is being made. The web app says "this
browser" wherever the extension says "the extension".

## Analytics and logging

**`account.signOut.finished` is the one sign-out event, and it is sent before the session
ends.** A signed-out reader sends nothing (`analytics.md`, "Who is counted"), so an event
recorded after sign-out would never leave the device. `useSignOut` passes `signOut` a
`beforeEndingSession` step that records the outcome and flushes the queue while the session
is still alive: how many writes were left unsent, how many the server had refused, whether
the device was offline, and whether the last cycle was given up on. Every sign-out goes
through it, from the menu, Settings, the consent screen and Connect the extension. Which
control was used is already counted (`app.accountMenu.itemChosen`,
`settings.sync.signOutChosen`).

**What a signed-out library offers is called but not yet sent.**
`account.signedOutStrip.signInChosen`, `account.signedOutLibrary.signInChosen`,
`account.accountOffer.createAccountChosen` and `account.accountOffer.dismissed` are made by
readers without a session, so like `account.signIn.*` they reach only the trail an error
carries until OV-62 brings consent and an anonymous id. The calls are in place so they
count the day it lands.

**The server logs each session by account id.** `account created` or `signed in`,
`link code exchanged` and `signed out` each carry the account's id, and `signed out` the
session's transport, so one account's sign-in can be followed to its sign-out; never the
address (`errors-and-logs.md`, "What a log line may carry"). A library that fails to open
on a switch is reported as a startup failure is.

## Departures, recorded

- **`SyncState.disconnect` is gone.** It existed so sign-out could forget the bookkeeping,
  which is exactly what sign-out must now not do, and nothing else called it.
- **The strips show on the library only**, not on every page the slot exists on: the
  designs draw them on the library, and a strip about the library on a reader's page would
  be beside the point.
- **47b's field is shown only when this device can generate.** The design draws it
  unconditionally; a field that cannot work is hidden, as the hero's keys note explains for
  the first-run page.
- **The account button's name is "Account, signed out"** only once this device has signed
  out of an account, as the designs draw it; otherwise it stays "Account".
- **`accountId` is required on both sign-in answers.** The server ships before any client
  that reads it, as the web app ships in the same image and the extension is built against
  the deployed server.

## Not built yet

This card is built as stacked PRs.

- Decision 5's migration of an install signed in when this lands. Until it lands, such an
  install keeps reading `overview-local-store` while signed in.
- Decisions 6 and 7: the move on sign-in, one per video, and its notice (47e). Until then, a
  new sign-in opens an empty account library and the no-account library waits where it is;
  47e has nothing to report until the move exists, so it is built with it.
