# The privacy policy and the terms

OV-79. Two public pages, `/privacy` and `/terms`, served to anyone, signed in or not, and
linked from everywhere a policy link already pointed: the create-account line (62j), Settings ›
Privacy and About (62i), onboarding's analytics screen (46b), every transactional email's
footer, and now the sign-in page. The Chrome Web Store listing (OV-2) names `/privacy` as its
privacy policy URL.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The two paths | `Routes.privacy()`, `Routes.terms()` in `packages/app-core/src/app/Routes.ts`; the entries in `createAppRouter.tsx`, inside the shell |
| One long-form layout for both | `features/legal/LegalPage/`: heading, date, contents, sections |
| A table that scrolls on a phone | `features/legal/LegalTable/` |
| The texts | `features/legal/PrivacyPage/PrivacyPage.tsx`, `features/legal/TermsPage/TermsPage.tsx`, each with its own `*_UPDATED_ON` |
| Who stands behind them | `features/legal/legalIdentity.ts` |
| The sign-in page's links | `PolicyLinks` under the form in `RequestLinkFlow`, only when signing in; creating an account has the terms line instead |
| The screens | `playwright/iwft/scenarios/policyPages.iwft.ts`, `pageObjects/LegalPagePageObject.testHelper.ts` |

## The pages

**Inside the shell, not beside it.** The shared page brings its own head because a visitor
has no library behind them (`sharing.md`). A policy's reader usually does: they came from
Settings, the create-account page or an email footer, and the masthead is their way back. So
both pages are children of `AppShell`, which also means the extension could render them, though
it never does: every link from the extension opens the web app's page in a tab of its own
(`policyPageUrl`), because the pages are the web app's.

**Nothing on the server.** `webAppPlugin` already serves `index.html` for any `GET` outside
`/api` and `/assets/` with no session check (`docs/architecture/deploy.md`), so the two paths
work in production the moment the router knows them.

**The layout.** One `h1` for the page, which takes focus on arrival as every auth screen's
heading does; "Last updated" with the date in a `<time>`; a contents `nav` listing every
section; then the sections, each an `h2` with an id the contents link to, and
`scroll-margin-top` clearing the masthead. The foot links to the other page and home. The
masthead already carries the app's `h1`, so like Settings, the queue and the library, a policy
page has two `h1`s on the document, and the test counts the one inside the article. The text
measure is `--measure` (46rem); a table is wrapped in its own `overflow-x: auto` container,
and the phone scenario asserts the document never scrolls sideways at 320px.

**The date is a constant, not the build stamp.** `BuildLine` shows the version and commit,
which move on every deploy; a policy's date should move only when its words do. Each page
exports its own `*_UPDATED_ON`, and changing the text means changing it.

**The document title** is set to "Privacy policy · The Overview" while the page is mounted and
put back on unmount, because these are the pages most likely to be opened in a tab of their own.

## What the privacy policy says, and where each claim comes from

Every sentence was checked against the docs and code below on 5 November 2026. When one of
these changes, the policy changes with it.

| Section | Backed by |
|---|---|
| Account and sign-in: email, first name, hashed links and codes, 15 and 10 minutes, 30-day sliding sessions, the one cookie, Brevo | `sign-in.md`, `V0001`, `V0003`, `V0005`, `fly.toml` (`SESSION_TTL_DAYS`, `MAIL_FROM`) |
| Deleting the account: the button, the code first, what goes in one step, what is asked of PostHog and when it happens, the deletion record, what stays, what the device does | `account-deletion.md`, `V0027`, `deleteAccount.ts` |
| Changing the name or email: the code to the current address and the fresh-session skip, the code to the new address, the notice to the old one with its seven-day link that ends every session, the change rows kept | `account-changes.md`, `V0026` |
| The library and settings synced to Neon in London | `sync-api.md`, `settings.md`, `personalisation.md`, `appearance.md`, `time-saved.md`, `tag-reuse.md`, `playlists.md`, `deploy.md` |
| Transcripts: the shared cache, two accounts agreeing, contributions kept a year and outliving the account; watched captions never sent; the cache lookup on Create; articles' text never kept, links never logged | `shared-transcript-cache.md`, `transcript-storage.md`, `watching-detection.md`, `pasted-article-links.md`, `article-notes.md`, `article-resources.md`, `server-side-transcripts.md` (Decodo) |
| Whose key: own keys device-local and direct; our key through the server to OpenAI (`gpt-6.1-sol`); "Only ever use my key"; onboarding's overview and topic suggestions; trial token and hashed address for 7 days | `byo-providers.md`, `tiers.md`, `onboarding.md`, `ourKeyModel.ts`, `TrialsRepository.ts` (`ADDRESS_RETENTION_DAYS`), `hashedAddress.ts` |
| What we learn: the pass every three overviews, what it sends (sentence, held and removed items, the 12 newest overviews' title, premise, topics and capture reason), on the key that made the overview, on us signed in only and uncounted, the notice and Undo, used only once shown (OV-248), Remove, Clear everything, Keep learning; For anyone on the reveal; sorting a sample into topics | `personalisation.md`, `onboarding.md` ("A sample is sorted"), `runProfilePassIfDue.ts`, `LearnedItem.ts`, `composeReaderContext.ts`, `ForAnyone.ts`, `TopicMatch.ts`, `generationRoutes.ts` |
| Narration: rendered on Fly, stored on R2, content-addressed and public by key, shared between readers, counted per day | `tts-pre-rendered-speech.md`, `audio-player.md`, `deploy.md` |
| Shared links: what the copy holds and leaves out, `noindex`, a count and nothing else, stopped stays stopped | `sharing.md` |
| Analytics: the three tiers, events held in memory before an answer, the random id and its renewal at sign-out, linking at sign-up, the catalogue, the server-side path to PostHog EU, the address cut to a network then discarded, postcode and coordinates removed, a year's retention | `analytics.md`, `analytics-consent.md` |
| Errors: always sent, what a report carries, redaction, no id when signed out | `errors-and-logs.md` |
| Logs: 14 days at PostHog, route and ids only, never an address or email; rate limits in memory for at most a day; the two daily caps keeping a hashed address 7 days | `errors-and-logs.md`, `api.md` ("Rate limits"), `server-side-transcripts.md` (`CALLER_RETENTION_DAYS`) |
| Assistants: tokens not sessions, the read tools and `mark_overviews`, every call logged | `mcp-connector.md` |
| Search by meaning: claims and searches to OpenAI for embeddings, kept beside the library, remade when an overview changes | `search-by-meaning.md`, `V0028` |
| Processors | `deploy.md`, `analytics.md`, `sign-in.md`, `server-side-transcripts.md`, `playlists.md` |
| On the device | `analytics-consent.md` ("The record"), `reading-position.md`, `playlists.md`, `tiers.md` (the trial token) |

**Two places where the policy says what is true rather than what was decided.** OV-62 decided
(3 Oct 2026) that anonymous analytics never linked to an account is deleted after 30 days, and
that the policy says so. The sweep isn't built, and PostHog keeps events for a year, so the
policy says a year and that 30 days is the intent. The other was account deletion, by hand on
request until OV-184 shipped it on 6 November 2026; the policy now describes the button.

**Holding events before an answer is disclosed, not dropped.** OV-46's question on the card
(28 Oct 2026) was whether holding events in memory before consent counts as collecting them.
The policy describes the hold plainly: held in the browser's memory, never stored or sent until
Allow, gone on No thanks or on leaving. Whether that is enough is for the legal review.

## What the terms say

What the service is and that it is provided as is; that overviews are written by a model and
can be wrong; the account rules (minimum age, one per person, deletion by email, suspension);
own keys under the provider's terms and at the reader's cost; allowances on our key as
allowances, with paid plans a placeholder until OV-18; acceptable use, including the shared
cache's reason for refusing a false transcript; the reader's content and the permission the
service needs to sync, render, serve assistants and shared links; sharing; assistants; YouTube
and other third parties; changes to the service; liability; changes to the terms, with
fourteen days' notice by email for a change that matters; governing law; contact.

## Decisions taken here, for the review to confirm

The card left two questions open and the texts needed answers to be written at all. Each is
one line in `legalIdentity.ts` or one sentence in a page:

- **The operator** is named as the person behind the service, in the United Kingdom, with
  `hello@theoverviewapp.com` (the `MAIL_FROM` address) as the contact.
- **Governing law** is England and Wales: the machine is in London, prices are in pounds, and
  the card already asks about the ICO fee.
- **Minimum age** is 13, the UK's age of digital consent.
- **Transfers** rest on the UK adequacy regulations for EU processors and standard data
  protection clauses with the UK addendum for the US ones. The card's "sign PostHog's DPA and
  confirm the transfer mechanism for each" is still to do, and is not something code can do.

## Does this change the texts?

Every card is checked against this list before its PR opens (`CLAUDE.md`, "Working style",
habit 4). A match means the page changes in the same PR, its `*_UPDATED_ON` moves, and a line
goes in the log below. No match means the PR says "No change to /privacy or /terms".

A change touches the **privacy policy** when it:

- collects, sends or stores anything new about a reader or a device, or stops doing so
  (a field on a record, a header, an id, a cookie, anything in `localStorage`)
- sends anything to a new third party, or stops using one (a provider, an API, a proxy, a
  CDN, a mail or analytics service), or moves one to another region
- changes what a reader's own key, or our key, sends to a model, or which provider our key uses
- changes how long anything is kept, or what a deletion leaves behind
- changes what a log line, an event or an error report may carry
- changes the analytics tiers, what is counted, or when a reader is asked
- changes what a shared link, a shared cache copy or an assistant can see
- changes what is stored on the device, or which of it is strictly necessary
- builds something the policy currently says is done by hand or not yet built (the 30-day
  sweep of unlinked anonymous analytics, the sweep of deletion records)

A change touches the **terms** when it:

- adds a paid plan, a price, a trial, or any charge
- changes an allowance or a cap readers can see, or who can use a feature
- adds a way a reader's content leaves the service (a new export, share or integration)
- changes account rules: age, one per person, deletion, suspension
- adds a third party whose terms the reader is bound by through us
- changes how changes are announced

Either text also changes when `legalIdentity.ts` does: the operator, the contact address, the
governing law or the minimum age.

## Revision log

One line per change to either page, newest first, with the card that caused it. The dates
match the pages' `*_UPDATED_ON`.

| Date | Page | Card | What changed |
|---|---|---|---|
| 2026-11-13 | privacy | OV-106 | What we keep about a device without an account counts its podcast link reads beside its article reads, now that onboarding reads a podcast link on the trial. |
| 2026-11-13 | privacy | OV-106 | Your library says an overview may be of a podcast episode, keeping its feed and audio addresses and the link the reader pasted without Spotify's sharer code, which a shared link shows. Transcripts and articles explains how our server reads a podcast link (the page, Apple's directory, the feed), where an episode's words come from (the shared cache, the show's own transcript, the show's YouTube channel, searched in the reader's browser with the extension) and that they join the shared cache with no account. Processors: YouTube also answers searches for an episode's video; playing an episode loads its audio from the show's host, which sees the request and the reader's address. |
| 2026-11-13 | privacy | OV-168 | Analytics says an event may carry a project's random id. What is stored on your device includes when you chose to keep a project the app asked about after 60 days left alone. |
| 2026-11-12 | privacy | OV-168 | Your library says an overview can be put in projects, and what a project holds (its name, a line on what it is for, and who put each overview in it and when). Assistants you connect says an assistant can read projects, make one, and put overviews in or take them out, marked with its name, and can't rename, archive or delete one. |
| 2026-11-12 | terms | OV-168 | Assistants: a connected assistant can organise overviews into projects on your behalf. |
| 2026-11-12 | privacy | OV-203 | Your library says an article's overview may keep up to five of the links the page makes, with their words and a line on why each is worth opening; Transcripts and articles says so beside "never the article's text", and that they go with a shared link and to a connected assistant. |
| 2026-11-12 | privacy | OV-285 | Transcripts and articles says our server also fetches an article when you regenerate its overview without the article open beside the extension; only an article the extension reads in your browser stays unseen. |
| 2026-11-12 | privacy | OV-284 | The settings that travel with the account include the cooking timer sound. |
| 2026-11-12 | privacy | OV-289 | The settings that travel with the account include whether cooking step by step reads the steps aloud. |
| 2026-11-12 | privacy | OV-250 | Your library names the steps a video or article gives among what an overview holds. |
| 2026-11-10 | privacy | OV-259 | Writing an overview says PostHog copies a monthly summary of the cost tally once a day (month, plan, cost, overviews and narrations, under a coded id that is neither the account id nor the analytics id) and the next copy after a deletion leaves the account out; PostHog's processor row and the retention table cover the summary. |
| 2026-11-10 | privacy | OV-259 | Writing an overview says we keep a daily tally of what serving each account costs: tokens and list-price cost on our key (failed attempts included), embedding tokens and cost, and proxy bytes, amounts only; a device without an account is tallied with nothing on it. The retention row for usage counts covers the tally. |
| 2026-11-09 | privacy | OV-225 | Your library names an overview's big picture among what it holds, and among what goes to OpenAI to make embeddings for search by meaning. |
| 2026-11-09 | privacy | OV-255 | Analytics says the event for an overview made, or one that can’t be made, says whether it was on your key or ours and names the provider and the model, not only when the model was refused. |
| 2026-11-09 | privacy | OV-247 | Server logs and safety limits says a line names the provider and model when an overview can’t be made on your own key because the model was refused or kept breaking its shape, and never what the provider said back. Analytics says that when an overview can’t be made because of the model you chose, the event names the provider and the model. |
| 2026-11-09 | privacy | OV-248 | What we learn from your overviews says nothing learned is used until it has been shown, on the library's notice or in Settings › Personalisation, and is used from then on. |
| 2026-11-09 | privacy | OV-245 | A new section, What we learn from your overviews: the profile pass, what it sends and on which key, the notice, use from the next overview, Remove, Clear everything and Keep learning. Writing an overview names learned items among what goes to a provider, For anyone on the onboarding reveal, and the pass that sorts a sample into topics; OpenAI's row and the retention table cover learned items. |
| 2026-11-09 | privacy | OV-122 | Writing an overview says a video's whole description goes to the model with its captions, title and channel; the providers section says watching a recipe video's step while cooking loads YouTube's player in privacy-enhanced mode, which sees the request and the network address. |
| 2026-11-09 | privacy | OV-221 | Settings carried by the account name what is learned from your overviews; assistants you connect can read what we know about you (the sentence and learned items with their sources, never removed or unseen ones) when the consent screen said so, until "Share with your assistants" is turned off, and its calls never log it. |
| 2026-11-09 | terms | OV-221 | Assistants: a connected assistant can read what we know about you, and Settings › Personalisation stops it. |
| 2026-11-09 | privacy | OV-229 | Your library says claims, key points and searches go to OpenAI to make embeddings for search by meaning, whichever key wrote the overview; the assistants section says search is by word and by meaning; OpenAI's processor row covers embeddings; the retention table gained a row for them. |
| 2026-11-08 | privacy | OV-199 | The account section says only creating an account makes one, and an address with no account that asks to sign in is mailed so, with no link; deleting your account says signing in again finds no account, and creating one starts empty. |
| 2026-11-06 | privacy | OV-184 | Deleting your account describes the button, the code first, what goes in one step, the ask to PostHog and its timing, the deletion record and what stays; the account section says the code guards deletion too; the retention table gained the deletion record and reworded narration. |
| 2026-11-06 | terms | OV-184 | Accounts: deleted from Settings after a code, not by email. |
| 2026-11-05 | privacy | OV-14 | The account section says the name can be changed and the email moved; the step-up code, the new-address code, the old address's notice and revert link, and the change record kept; a retention row for the codes and the record. |
| 2026-11-05 | both | OV-79 | First texts, written from what was built on this date. |

## Not built

- **Legal review** of both texts, which the card's definition of done requires and the first
  release to hand-picked testers may not.
- **The 30-day deletion** of unlinked anonymous analytics, which changes a sentence here when
  it lands. Account deletion landed with OV-184.
- **Checking the ICO data protection fee**, from the card.
