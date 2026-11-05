# Changing the name and the email on an account

Designs "OV-14 1–4" (14a–14j). Card: OV-14.

Until this slice an account's name was written once, by the sign-in that created it, and its
email was fixed for good. A reader can now change both from Settings › Account & sync. The
name is one request. The email is four steps, because an address is the credential: a code
to the current address proves it is the account holder asking, a code to the new address
proves they own it, and the old address is told afterwards with a way to undo it.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The name, saved at once; empty clears it | `PUT /api/session/account` in `apps/api/src/auth/sessionRoutes.ts`; `packages/domain/src/AccountUpdate.ts` |
| A code to the current address, kept as session state | `V0026__account_changes.sql` (`sessions.verified_at`, `session_verifications`), `src/auth/sessionVerification.ts`, `POST /api/session/verification` and `/confirm` |
| A code to the new address, and the change row that outlives it | `email_changes` in `V0026`, `src/auth/emailChange.ts`, `POST /api/session/email-change` and `/confirm` |
| The old address's way back, public, ends every session | `POST /api/auth/email-change/revert` in `authRoutes.ts`; `packages/domain/src/revertEmailLink.ts` |
| The four mails | `src/mail/accountEmails.ts`, `Mailer.sendAccountMail`; `transactionalEmailHtml` learnt to go without a button |
| The wire shapes, timings and refusal reasons | `packages/domain/src`: `CodeRequest.ts`, `EmailChangeRequest.ts`, `VerificationAsked.ts`, `EmailChangeAsked.ts`, `EmailChangeReverted.ts`, `authTimings.ts`, `ApiErrorCode.ts` (`verification_required`) |
| The client's calls, over the session this device holds | `packages/sync/src/AuthApi.ts`; `features/auth/useSessionAuthApi.ts`, `mutations/use*Mutation.ts` |
| The tile, its two rows, and the flow inside the Email row | `features/auth/components/AccountTile/`, `NameEditor/`, `EmailChangeFlow/`, `CodeStep/`; mounted by `features/sync/components/SyncPanel/` |
| Where the mail's button lands | `features/auth/RevertEmailPage/`, `Routes.revertEmail()` |
| Other devices catching up | `features/auth/queries/sessionQuery.ts` writes the server's answer back into the connection |
| The words the field says when the server says no | `features/auth/util/accountChangeProblem.ts` |
| The routes, over PGlite | `apps/api/src/auth/accountChanges.test.ts`, `src/mail/accountEmails.test.ts` |
| The screens, against the simulated server | `playwright/iwft/scenarios/accountChanges.iwft.ts`, `pageObjects/AccountTilePageObject.testHelper.ts`, `RevertEmailPageObject.testHelper.ts` |

## The name

Design 14a–14b. The **Signed in as** tile has two rows, Name and Email, each with its own
Change, rather than one Edit for both: the name saves at once and the email takes four steps,
so they should not share a Save. An account with no name shows "Not set", "Your email shows
in its place", and the button reads Add name.

The row opens in place with the field focused and the current name selected. Emptying it is
how a name is removed, and the hint changes to say so before saving; there is no separate
Remove. The validator is `FirstName`, eighty characters; the design's "40 or fewer" was a
placeholder. Saved, the row closes and a status line says the other devices show it the next
time they check in, which is true in a plain sense: `useSessionQuery` writes the server's
name and email into the connection whenever they differ, and every signed-in device asks
`GET /api/session` on its way into Settings and the connections section.

**The session query is keyed by the account id, not the email**, as it was, since the email
is the thing that now changes. A connection stored before accounts carried an id gets no
write-back, which is the one case the guard leaves alone: it cannot tell whose answer it
would be writing.

## The email, in four steps

**1. Confirm it's you (14i).** Pressing Change on the Email row asks `POST
/api/session/verification` at once, with no form. A session made or verified in the last
fifteen minutes answers `{ required: false }` and nothing is sent, which is GitHub's
sudo-mode rule: the reader has just proved the same thing. Otherwise a code goes to the
account's own address and the row opens on "Confirm it's you". Confirming sets
`sessions.verified_at`, good for fifteen minutes, and the code is bound to the session it was
made for: one made for another session is refused. The step is session state rather than
email-change state so that OV-184 (delete account) can require the same thing. The verified
time is read by the two routes that need it, not by the session lookup every request makes,
so the path every call takes never depends on this slice's column: `twoDevices.test.ts` runs
the app against a database held at an earlier migration, and would otherwise sign nothing in.

**2. The new address (14c).** `POST /api/session/email-change` under the verified session.
The answer is always `202`, as the magic-link route's is, and never says whether the address
has an account. A code goes to the *new* address; if that address already has an account the
mail says so instead of carrying a code, and only its inbox learns it. The account's own
address is refused in place with no mail, and the field checks it is a whole address before
anything is sent.

**3. The code (14d).** `POST /api/session/email-change/confirm`. One statement spends the
code, and only a code made for this account counts; then the account moves only if its email
is still the one the change started from, so a change confirmed on two devices moves it once.
An address that gained an account between the ask and the confirm is a unique violation,
answered `409 already_exists`, and the row leaves only "Use a different address" and Cancel.

**4. Swap and tell (14e).** The row closes on the new address and one status line: what it is
now, that the old address was told, and that nothing was signed out. The line stays until the
reader leaves the section. The old address gets "Your email was changed" with the date, the
time in UTC, and the button below.

**Sessions survive an ordinary change.** Nothing about a session is keyed by email, and
ending the others would sign the extension out for no gain. The step-up stops a stolen
session from making the change at all; the revert undoes one that got through, and does end
sessions.

## Moving it back

The old address's mail carries one button, "This wasn't me, move it back", which opens
`/account/revert#token=…` in the web app. The token rides in the fragment and is spent by a
POST from the page, for the same reason a sign-in link is: a GET that acted would be spent by
the first mail scanner to follow it. It is hashed by the same `hashToken`, works once, and
lives seven days from the change.

`POST /api/auth/email-change/revert` is public, since every session is about to end. In one
statement it marks the change reverted, then moves the account back only if its email is
still the one that change made, then deletes every session on the account, the one that made
the change included, and cancels any pending change. It refuses when the link has lapsed
(`expired`), when it was used or the account has moved again since (`spent`), or when the
old address has become someone else's account (`taken`, with the address, so the page can
name it). Each is `410 link_invalid` with the reason in `details`, and the page says which in
plain words with the help address and no button, since none would work.

**The change rows are kept, not consumed and forgotten**, because the revert token lives on
them. Design 14j: the page is the brand and one tile, three states. Done names the address,
says every device was signed out, and offers Sign in; a browser still signed in to the
account signs itself out first, the way the connect-extension page does, because a web app
keeps its server once its session is gone and `/sign-in` would only send it back to the
library.

## The mails

Design 14h, in the OV-88 template. "Confirm it's you" and "Confirm your new email" carry
their code set large and no button; the already-has-an-account mail carries neither; "Your
email was changed" carries the one button. The template's `action` became nullable and a code
may stand without a lead for this. The "Confirm it's you" mail cannot point at a
sign-out-everywhere control, since there isn't one, so it says what is true: ignore the code,
sign out of any device you don't recognise, write to help. The help address is `SUPPORT_EMAIL`
on the server and `legalIdentity.contactEmail` in the app.

## Rate limits and cooldowns

Five step-up asks and five change asks an hour per account, thirty reverts an hour per
address, on top of the limits every route has (`docs/architecture/api.md`, "Rate limits").
Inside the one-a-minute cooldown a second ask answers as if sent, with the live code's expiry,
and sends nothing; the screens count the minute down as the sign-in screens do. Past the
hour, the page hides the button that cannot work and gives the time to try again in the
reader's own clock, computed from the server's `retryAfterSeconds`.

## What the reader sees when it goes wrong

The server answers one `link_invalid` for a wrong, spent or expired code. The page tells
them apart with the ask's own expiry, which it holds: past it, the code "has expired", the
primary button hides and Send a new code is the way on; before it, the code "doesn't match".
Every error sits under the field it belongs to, is announced by `role="alert"`, and keeps
focus in the field. Opening a row focuses its field; arriving on a code step focuses its
heading.

## Analytics and logging

Nine events under `settings.sync` (name saved with `cleared`; verification asked with
`required`, confirmed, refused with `reason`; email change asked, confirmed, refused with
`reason`) and two under `account.revertPage` (used, refused with `reason`). Ten log lines
under `auth` (`docs/architecture/errors-and-logs.md`, "Sign-in and mail"), none of which
carries an address, a code or a token; `accountChanges.test.ts` asserts it.

## Decisions, and why

- **A code, not a magic link, for the new address.** A link must land in a browser already
  signed in as the account, else the page can only say "sign in here first and open it
  again"; a link that acted alone would be a lower bar than sign-in sets; the reader is
  already sitting in Settings; and the extension's panel can only work by a code anyway. The
  card said "magic link" and was changed on 5 November 2026.
- **The step-up and the revert link were added after the first designs**, on the same day,
  as the two places where the flow was lighter than common practice: no re-authentication
  before a sensitive change, and a notice with no way to act on it.
- **`PUT`, not `PATCH`, for the name.** The CORS allowlist admits `GET`, `POST`, `PUT` and
  `DELETE`, and one nullable field is the whole update.
- **Taken is told by mail, not on the screen.** The signed-in reader could be told directly,
  as GitHub does; the sign-in page's rule that the answer never reveals an account was kept,
  at the cost of one trip to the inbox in the honest case.

## Where the build departs from the design

- **The revert page sits inside the shell**, with the masthead above it, as `/sign-in` does;
  14j draws it on the bare ground.
- **The step-up's "Sending a code…" moment** is a line with a spinner before the code box
  appears; the design opens straight on the box.
- **The hourly limit's count is the limit itself**, five, rather than a count of asks, since
  the server does not say how many were made.

## Not built

A link in the confirmation mail for a reader on the same device; telling the new address when
a change is reverted; a sign-out-everywhere control, which the "Confirm it's you" mail would
like to point at; a sweep of spent codes and old change rows, which is the same later cron as
the session sweep.
