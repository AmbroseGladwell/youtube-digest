# Deleting an account

Designs "OV-184 1–3" (184a–184g, and 14h·2 for the mail). Card: OV-184.

A signed-in reader deletes their own account from Settings › Account & sync. It is immediate
and cannot be undone: one transaction removes the account and every row under it, the files
and analytics records that live elsewhere are asked for straight after, and an audit row says
how each of those asks ended. Before any of it the reader proves it is them with the same
"Confirm it's you" code the email change sends (`account-changes.md`), and reads what goes
and what stays. Until this card, deletion was by email and by hand, which the privacy policy
said in as many words.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The route, behind the verified session | `DELETE /api/session/account` in `apps/api/src/auth/sessionRoutes.ts` |
| The transaction, and the steps after it | `src/auth/deleteAccount.ts`: `eraseAccount`, `finishAccountDeletion` |
| The audit row | `V0027__account_deletions.sql`, `src/auth/AccountDeletionsRepository.ts` |
| Erasure at PostHog | `src/postHog/PersonEraser.ts`, `postHogPersonEraser.ts`; `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_APP_HOST` in `loadConfig.ts` |
| The step-up's mail saying what the code is for | `packages/domain/src/VerificationPurpose.ts`; `purpose` on `POST /api/session/verification`; `src/mail/accountEmails.ts` |
| Retrying what did not finish, on the machine | `src/scripts/finishAccountDeletions.ts`, `fly ssh console -C "node apps/api/dist/scripts/finishAccountDeletions.js"` |
| The client's call | `deleteAccount` in `packages/sync/src/AuthApi.ts`; `features/auth/mutations/useDeleteAccountMutation.ts` |
| The entry and the dialog | `features/sync/components/SyncPanel/`, `features/auth/components/DeleteAccountDialog/`; the code step is `CodeStep` in its dialog variant |
| Leaving the account on this device | `features/accountLibraries/useDeleteAccount.ts`, `leaveDeletedAccount` in `features/sync/SyncRuntime.tsx`, `forgetAccountOnDevice.ts` |
| Dropping the account's library once it is closed | `packages/store-local/src/deleteLocalLibrary.ts`, `deleteLibrary` on `App`, `stores/LibraryRuntime.tsx`, `stores/DeleteLibraryContext.ts` |
| The notice afterwards | `deleted` on `SignOutNotice`, `signOutNoticeCopy.ts` |
| The routes, over PGlite | `src/auth/accountDeletion.test.ts` |
| The screens, against the simulated server | `playwright/iwft/scenarios/accountDeletion.iwft.ts`, `pageObjects/DeleteAccountDialogPageObject.testHelper.ts` |

## The three questions the card left open

**Immediate, with no grace period.** The explanation names the consequence and the code proves
the inbox, so a grace period would protect nothing those don't. It would also mean keeping
data someone asked us to delete, and a sweep job this project has no runner for, which is why
the 30-day deletion of unlinked anonymous analytics is unbuilt too. Signing in with the same
address afterwards finds no account and is told so by mail; creating an account with it makes a
new, empty one, through onboarding like any other (OV-199, `sign-in.md`).

**The step-up, not a fresh magic link and not a typed address.** Sessions slide for 30 days, so
an unlocked device could otherwise delete an account with no way back. The inbox is the
account's credential, so the irreversible action asks the inbox the way the email change does:
`isSessionVerified` is the one check, and a session made or verified in the last fifteen
minutes passes it without a code. The step was built as session state by OV-14 so that this
card could require it; what this card adds is a `purpose` on the ask, so the mail says
"delete your account" rather than "change your email", and "without it your account can't be
deleted" where the warning is. The verification itself stays purpose-free, as GitHub's sudo
mode is.

**Shared links go with the account.** `shares` cascades, so `/s/<token>` answers 404, the page
for a link that goes nowhere, rather than 410's "no longer shared". A tombstone with no owner
would have needed the row kept with its snapshot nulled, for the benefit of people the reader
will never contact again.

## What goes, and what stays

Every table carrying the account was read from the schema rather than from a list, and the
test does the same: it reads `information_schema.columns` for every `account_id` and
`requested_by` column and asserts none holds the id afterwards, except the two below.

- **Cascades from `delete from accounts`:** `sessions` and with them `session_verifications`;
  `records`; `link_codes`; `account_transcripts`; `connections`, then `connection_tokens`;
  `oauth_authorizations`; `shares`; `overview_usage`; `overview_reservations`;
  `narration_render_usage`; `account_costs`; `email_changes`, whose kept rows hold both addresses.
- **Deleted by hand, with no foreign key:** `magic_links` for the address, which hold the
  address, the first name and the anonymous id; `service_transcript_usage` rows whose caller is
  `account:<id>`; `audio_renders where requested_by = account`, and their files in R2.
- **Kept on purpose:** `podcast_transcript_sources`, where an episode's words were found, which
  never named an account. `trial_*` and `our_key_usage`, which never carried the account. (The
  shared transcript cache and its year-long contributions are gone since OV-295.) And the audit
  row, below. The in-memory rate-limit counters expire within a day on their own.
- **PostHog's copy of the cost reports** drops the account at its next daily full refresh, since
  the `cost_reports` views read the cascaded tables (`unit-economics.md`).
- **Nothing at Brevo.** The transactional call creates no contact. No notice mail goes after
  deletion either: the code already proved the inbox, and the done state says it.

**Narration is content-addressed and shared** (`tts-pre-rendered-speech.md`): a render is keyed
by its words and voice, and `requested_by` names only the account that first asked. Nothing
records a second account using the same file, so deletion removes every render the account
asked for, and a reader who happened to share one sees it made again on their next play.
Audio is derived and disposable, so this is a cost of one re-render in a rare case, and the
privacy policy now says exactly that rather than "unless another reader's overview shares one".

## The order, and what the reader is promised

1. `DELETE /api/session/account`, under the session, cookie or bearer, so the panel works too;
   `verification_required` unless the session is verified.
2. One transaction: the render keys and the account's anonymous id (from its create-account
   link) are captured, the audit row is inserted with a status per step, the three by-hand
   deletes run, and the account row goes. From the commit every session is dead, and the
   answer clears the cookie.
3. Then, outside the transaction and each bounded to ten seconds: the R2 objects are deleted;
   PostHog is asked to delete the person under the account id and, where there was one, under
   the anonymous id, with its events.
4. `204` once the attempts are made. The dialog promises what the policy promises: the account
   is gone now, and the analytics provider erases its copies after we ask.

**A failure before the commit** is an ordinary error: nothing was deleted, the reader is still
signed in, and the dialog says so with Try again (184d). **A failure after it** never reaches
the dialog. The audit row keeps the step's status as `failed` with the redacted error, the
server logs `account deletion step failed` at `error`, which the Slack alert on new issues
picks up (`errors-and-logs.md`), and the retry below finishes every unfinished row by hand.
There is no job runner, so it is run when the alert says to.

**Run the retry on the machine, not on a laptop.** The npm script reads `DATABASE_URL` from
the local `.env`, which is development, where it will truthfully report no unfinished
deletions and leave production's rows exactly where they were. The script ships in the
production image, so the real route is

```
fly ssh console -C "node apps/api/dist/scripts/finishAccountDeletions.js"
```

It says which database it is looking in and whether erasure is configured there before it
touches anything, then prints every unfinished row and what each step became, so running it
is also the check.

### Erasure at PostHog

The person under a distinct id is looked up, then deleted with `delete_events=true`. PostHog
removes the person within minutes and the events in a later scheduled run, so the step's
success is **queued**, never done, and the audit row says so. Error reports share the
account's distinct id, so the one request covers them. Logs have no erasure and expire in
fourteen days on their own. An id nothing was ever sent under answers `absent`, recorded as
`skipped`, which is what an account that turned analytics off looks like.

It needs a personal API key and the project's numeric id: `POSTHOG_PERSONAL_API_KEY` in
Bitwarden's `overview-prod` and `POSTHOG_PROJECT_ID` in `fly.toml`, which is `289890`, against
the project's own host (`eu.posthog.com`, not the ingestion host events go to). The key is labelled
`overview-prod account deletion` in PostHog, scoped to the production project alone, and
carries one permission: **Person**, read and write. The two calls above are all it makes, so
nothing else is granted. Not **Data deletion** despite its name, which covers PostHog's own
queue of pending deletions rather than the person delete; if the DELETE ever answers 403 that
is the first scope to try, and this line should record it. It is deliberately not the
source-maps key, which has error tracking write and lives in GitHub's secrets
(`docs/architecture/errors-and-logs.md`, "Source maps"). Erasure is on exactly when the key is set, which is
why the id can ship in `fly.toml` ahead of the secret import rather than refusing the machine
its startup, the same shape as R2's bucket; a key with no project is still refused, since an
erasure has to name where it acts. Without the key the step is recorded as `not_configured`,
the startup line `account erasure` says so, and the retry above
picks those rows up once the secret lands. Importing the key is `task deploy:secrets` from a
machine with a Bitwarden token: the automated deploy ships the image and never imports
secrets, so a key that is only in Bitwarden is not yet in production. The first
deletion in production should be checked in PostHog's activity log before the row is trusted:
the API shape was taken from PostHog's data-deletion docs, not exercised live.

### The audit row

`account_deletions`: the account's opaque id, the anonymous id joined to it, the narration
keys, one status per step (`pending`, `done` or `queued`, `skipped`, `not_configured`,
`failed`), the last error, when the account was deleted and when every step finished. It is
an audit record in `analytics.md`'s sense, a fact the system itself needs later, and the privacy
policy lists it. It is not swept; a year is the intent, and deleting old rows is by hand until
there is a cron for the session sweep too.

## On the device

Deleting runs through `useDeleteAccount`, in this order and only once the server has answered
`204`: the engine stops with no last cycle, since there is nothing left to send to; the
connection is cleared, which swaps `LibraryRuntime` to the no-account library and closes the
account's; the account's database is deleted **after** that close, because a deletion against
an open connection fires `versionchange`, which the open connection answers by closing and
declaring the tab out of date; the per-account keys go (`overview.libraryView.<id>`,
`overview.captureQueue.<id>`, the account's reading positions); and the app goes to Start.
`accountSeen` stays, since it never said whose account. The analytics anonymous id renews as
it does at any sign-out.

The `deleted` notice sits in the sign-out notice's slot (184e, 47d-2): "Your account is
deleted. This device and your others are signed out." Other devices find their session gone
on their next call and show Sign in again; their local copies stay on them, as after a
sign-out, and the dialog's Kept list says so.

## The dialog

One dialog in the Delete overview shell, a centred card on a desktop and a bottom sheet under
48rem, which is the phone and the panel alike (184f, 184g). Three steps:

1. **Explain** (184b): "Delete your account?", the consequence first (deleted straight away,
   no undo, the address starts a new empty account), then Deleted (seven lines) and Kept
   (three), both visible before anything is pressed. Focus starts on Cancel; Escape, Cancel and
   × close it, and nothing is deleted. Continue counts `settings.sync.deleteAccountStarted`
   and asks for the code; while it asks the actions are "Checking it's you…". Over the hour's
   limit on codes, Continue hides and the time to try again is given (`askProblem`).
2. **Confirm it's you** (184c): `CodeStep` in its `dialog` variant, so the heading is the
   dialog's own and the box has no surface of its own. "We sent a code to … Enter it to delete
   your account.", the fifteen-minute note, the Code field, Send a new code with its countdown,
   and "Delete my account" as the primary action. Wrong and expired are said in place by
   `codeProblem`; expired hides the primary until a new code is sent. A session made or
   verified in the last fifteen minutes skips this step: Continue goes straight to deleting.
3. **Deleting** (184d): no ×, no Cancel, Escape does nothing. A `verification_required` from
   the delete itself, a verification that lapsed between the code and the press, sends the
   dialog back to the ask, as the email change does.

**The entry** is "Delete account…" under Sign out, below the tiles, in the same quiet style:
a way out of the account like Sign out, not a setting of it (184a). It is there only while
signed in with a live session, and hidden while Sign out is still syncing. The primary action
stays the app's orange throughout; there is no destructive red, and the words carry the weight.

## Analytics and logging

Three events under `settings.sync`, beside OV-14's: `deleteAccountStarted`,
`deleteAccountConfirmed`, sent and flushed before the request so that it is erased with the
rest, which is right, and `deleteAccountRefused` with `notVerified`, `limited` or `failed`.
The count that survives is the audit table. The step-up's own asked, confirmed and refused
events are the email change's and are not sent again here.

Log lines under `auth`: `account deleted`, with the deletion id, how many narration files
there were and each step's status; `account deletion step failed`; and `account deletion
finished` from the retry. `verification asked` gained `purpose`. None carries the address.

## Legal pages

Both texts changed in this card's PR (`legal-pages.md`, revision log): the policy's "Deleting
your account" paragraph now describes the button, the code, what goes in one step, what is
asked of PostHog and when it happens, what stays and why, and what the device does; the
account section says the same code guards deletion; the retention table gained the audit row
and reworded the narration row; the terms say the account is deleted from Settings.

## Not built

- A sweep of old `account_deletions` rows, the same later cron as the session sweep.
- Telling the reader's other devices that the account is gone rather than letting them find
  their session has lapsed; it would need a tombstone keyed by session, and the lapse is
  honest enough.
- Cancelling a paid plan here, once OV-18 makes one.
- An export before deletion.
