# The Chrome Web Store listing

OV-2. `docs/architecture/deploy.md` ends at a zip and an id: a verified package on a GitHub
release, and an extension whose id the store assigned and production's CORS already vouches
for. This is the other half: the listing that zip hangs off, the words and pictures the store
requires, and the job that sends each new release to review without anyone opening a browser.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The release's store zip is what the store gets, never a laptop's | the `publish (extension)` job in `.github/workflows/ci.yml`, after `deploy` |
| Only a version the deploy job tagged is sent | `tagged` in the `deploy` job's `outputs`, read by the job's `if` |
| The store's v2 API, spoken to directly rather than through an action | `scripts/publishExtension.mjs` |
| The item addressed by the id derived from the manifest's own key | `extensionIdFrom` in `scripts/extensionId.mjs`, called by the CLI |
| Upload, then submit, then read the store back before saying so | `publishExtension`, `acceptedProblem` |
| A version already published, or one already in review, is not sent again | `submissionDecision` |
| Without the four credentials the job says so and skips | `missingCredentials`, the `credentials` step |
| The escape hatch from a laptop | `task deploy:extension:publish` |
| The listing's screenshots, rendered from the real components | `packages/app-core/playwright/store/`, `playwright-shots.config.ts`, `task store:screenshots` |
| The words | this file, below |

## Unlisted, and why that is not a smaller public launch

The first release goes to hand-picked testers (`docs/features/onboarding.md` is written for
them), so the listing's visibility is **Unlisted**: anyone with the link can install it, and
nothing surfaces it in search or in the store's categories. That answers OV-2's own open
question, and it is set on the item's Distribution tab, not by the API. Visibility is one of
the two things the v2 API deliberately cannot change (the other is creating an item).

Unlisted is not a way round review. An unlisted item is reviewed exactly as a public one is,
against the same policies, and the privacy disclosures below are required either way. What it
buys is control of who finds it, not a lighter inspection.

## Once, by hand

The account exists and holds a draft: a developer account on a personal Google account, the
one-time fee paid, a non-trader declaration under the EEA rules, and `the-overview-0.1.0.zip`
uploaded on 2026-09-28 purely to make the store assign the id. Everything below is what that
draft still needs before it can be submitted.

1. **Publisher › Settings.** Set the publisher display name to **The Overview**, and verify
   the contact email. The store will not let an item be published until that address is
   verified, and the address is shown on the listing. Note the **publisher ID** on this page:
   it is half of every API path below.
2. **The item's Store listing tab.** The copy is in "The words" below. The description field
   the store calls the *short* description is read out of the manifest, so it is already
   `apps/extension/manifest.json`'s `description` and should be changed there, not here.
3. **Graphics**, all of them in `apps/extension/store`: five screenshots at 1280×800 from
   `task store:screenshots`, and the store icon and promo tile from `task store:assets`.
4. **The item's Privacy tab.** The single-purpose statement, the per-permission
   justifications and the data-use disclosures, all below. The privacy policy URL is
   `https://theoverviewapp.com/privacy` (`docs/features/legal-pages.md`).
5. **The item's Distribution tab.** Visibility **Unlisted**. Regions: all. Not a paid item.
6. **Submit the first one by hand**, from the dashboard, with the zip from the newest
   release. The listing has to be complete before anything can be submitted at all, and a
   job that submits to a half-written listing just fails.
7. **Then set the four secrets**, and not before. The job skips while any of them is missing,
   so until this step a merge deploys and tags exactly as it always did. From the next bump
   onwards the store gets its zip without anyone opening a browser.

## The words

**Name.** The Overview

**Short description**, the manifest's `description`, 119 characters of the 132 allowed. It
is the store's short description *and* what Chrome shows in its own extension list, so it
names the sources and what comes back rather than leading with the verdict:

> Bookmark videos, articles and recipes. Get an overview, chapters and next steps you can
> read, hear, or hand to your AI.

**Category.** Productivity › Workflow & Planning. **Language.** English (United Kingdom).

**Detailed description.** Structured the way a store listing is read rather than the way a
README is: a hook, what an overview holds, how it works, what you get, and the two links the
store requires. It says what the reader gains, never what their saved list is full of: the
product is blunt with its reader, the listing is not blunt about them.

The section order of "What every overview holds" is the reader's own
(`features/reader/ReaderPage`), not the README's. The allowances come from
`docs/architecture/tiers.md` and move when it does; no paid plan is described, because none
can be bought yet. Podcasts and PDFs are left out, though the product's own onboarding calls
them coming: an unshipped capability on a store page is a rejection risk.

**There is no signed-out tier to describe.** Since OV-46 (28 October 2026) a reader without
an account sees no overviews at all, so the copy offers an account from the start and the
privacy line says what an account actually costs: an email address, no password, no name
required (`firstName` is optional in `MagicLinkRequest` and nullable in the column).

> Bookmark the videos, articles and recipes you meant to come back to, and get something you
> can actually use: a short overview, the chapters, the full transcript, and the steps worth
> acting on. Read it, listen to it on the way to work, or hand it to your AI assistant.
>
> Saving something is easy. Coming back to it is the hard part. The list grows, and the few
> things you do get to turn out to be eight minutes of hook and story wrapped around thirty
> seconds of substance. The Overview reads it for you and gives you back the part you wanted,
> in ninety seconds.
>
> ➤ What every overview holds
>
> • In one line: what it is, so you can recognise it later
> • Core claim: the single assertion it makes
> • Verdict: how novel it actually was, and why
> • Key points: three to five bullets, substance only, hook and call to action removed
> • How to apply: one to three concrete things to do this week, or an honest "nothing"
> • What it sells: a course, a membership, a supplement, their own app, recorded every time
> • Watch it anyway?: and it is allowed to say no
>
> ➤ How it works
>
> Open a video and press The Overview in the player's own action row, or open the side panel
> from the toolbar and generate an overview for an article too. The overview is written from
> the captions or page and arrives in the panel, beside what you were watching or reading.
>
> • Read it, or have it read aloud with the text following the audio
> • Chapters and the full transcript sit beside it; tap any point and the video jumps there
> • Search your library, and filter by topic or by verdict
> • Paste a link to an article and get the same thing for that
>
> ➤ A whole playlist, not one video
>
> Paste a playlist link and convert what is already there, or follow it so new videos become
> overviews as they are added. You are told what it will cost before anything starts, and
> nothing runs faster than the pace you set.
>
> ➤ Recipes get a cooking mode
>
> Save a recipe and you get one step at a time, read aloud and waiting for you, with the
> ingredients a tap away, the servings scaled and the oven in your own units.
>
> ➤ Ask your assistant what you have saved
>
> Connect Claude or another MCP assistant and it can search everything you have kept by topic,
> tag or verdict, read any overview in full, and cite the second a point was made.
>
> ➤ See the hours add up
>
> Every overview you read instead of watching the video or reading the article is counted, so
> the time the habit gives back is a number you can see.
>
> ➤ What's included
>
> Free, with an account:
>
> • 5 overviews a month written on us, or 10 a month on your own AI API key
> • Your library synced between Chrome and the web app at theoverviewapp.com
> • Narration in any of the voices, and your library open to your AI assistant
>
> ➤ Bring your own key, and it stays yours
>
> Add a key for Anthropic, OpenAI, Google, DeepSeek, xAI or Mistral and it is stored on your
> device and sent straight to that provider, never through our servers. There is a setting
> that says "only ever use my key", and it is obeyed.
>
> ➤ Privacy
>
> An account needs only an email address, with no password: you sign in with a link or code
> we email you. Analytics are off until you are asked and say yes. We never sell your data.
>
> Privacy policy: https://theoverviewapp.com/privacy
>
> By installing this extension you agree to the terms at https://theoverviewapp.com/terms

## Single purpose

The store asks for one sentence, and will reject a listing whose permissions reach past it:

> The Overview turns a video or article the reader is looking at into a structured, written
> note in a side panel, and keeps those notes in a searchable library.

## Why each permission

One justification per entry in the manifest, each naming the code that needs it. The store
reads these; a permission in the manifest that nothing uses is a rejection, so this table and
`apps/extension/manifest.json` move together.

**Say what the code does, not what sounds tidy.** Three of these said more than was true in
their first draft, and the manifest or the source contradicts each: the panel is not the only
surface, because `options_ui` registers `app.html`; `tabs` does look at tabs the reader has
not asked about, because the worker queries every YouTube watch tab by URL; and "nothing is
kept on a server unless the reader signs in" is vacuous now that an account is needed to make
an overview at all. A reviewer reads the manifest beside the justification.

| Permission | What to paste |
|---|---|
| `activeTab` | Pressing the toolbar button or the context-menu entry is what grants access to the tab the reader is on, which is how the extension reads the page it is being asked about without standing access to every site. |
| `contextMenus` | Adds one right-click entry, "The Overview", which opens the side panel on the page or link the reader right-clicked. |
| `sidePanel` | The extension's interface is a Chrome side panel: it is where an overview is requested, read, listened to and searched. The manifest also registers a full page version of the same interface as the options page, which Chrome opens from the extension's Details screen. |
| `tabs` | To tell which video is in front of the reader, so the overview is about the right one and the panel follows them from video to video. The extension reads the active tab, and queries YouTube watch tabs by URL for the same purpose. This permission is used for addresses and titles only. Reading the contents of a page needs `scripting`, and happens only when the reader asks for an overview of that page. |
| `scripting` | To inject two small scripts into the tab the reader is on. One reads an article's text, and runs when the reader asks for an overview of that page. The other reads the YouTube player's current position, so the transcript and the read along can follow the video while the overview is open. Neither runs on a page the reader has not opened the panel against. |
| `storage` | Settings, the chosen provider, and the reader's own API key, all kept on the device. |
| `unlimitedStorage` | The library of overviews, with their transcripts and narration audio, is held on the device in IndexedDB, and a few hundred of them exceed the default quota. Narration audio is the largest part. The library also syncs to the reader's account, so the device copy is what makes it searchable and available offline rather than the only copy. |
| `declarativeNetRequestWithHostAccess` | One rule, which removes the `Origin` header from this extension's own requests to youtube.com. YouTube answers 403 to a transcript request that carries a `chrome-extension://` origin, and `Origin` is a forbidden header that `fetch` cannot drop. The rule is scoped to requests this extension makes, to youtube.com, of type XHR, so it can never touch a call carrying the reader's API key. |

**Host permissions**, `https://www.youtube.com/*` and `https://m.youtube.com/*`: to read the
watch page the reader is on and fetch that video's captions, which is the text every note is
written from.

**Optional host permissions**, asked for only when the reader chooses the thing that needs
them, and never at install:

- The six provider APIs (`api.anthropic.com`, `api.openai.com`,
  `generativelanguage.googleapis.com`, `api.deepseek.com`, `api.x.ai`, `api.mistral.ai`):
  granted when the reader enters their own key for that provider, so the request goes from
  their browser straight to the provider (`docs/features/byo-providers.md`).
- `http://*/*` and `https://*/*`, granted when the reader pastes a link to an article they
  want a note on, for that site (`docs/features/pasted-article-links.md`).

**Remote code.** The answer is no: everything the extension runs is in the package. The
provider APIs return text, never code.

## What the store is told about data

The Privacy tab's checkboxes, and the answer each gets. These are derived from
`/privacy`, which is the authority; if one of them changes, that page changes too
(`docs/features/legal-pages.md`, "Does this change the texts?").

| Category | Collected | Because |
|---|---|---|
| Personally identifiable information | **Yes** | An optional account holds an email address and a first name (`docs/features/sign-in.md`). |
| Authentication information | **Yes** | The reader's own provider API key is stored on the device, and a session token is held after sign-in. |
| Website content | **Yes** | The captions of a video, and the text of an article the reader asks about, are read and sent to a model. |
| User activity | **Yes** | Product analytics, which are off until the reader is asked and says yes (`docs/features/analytics-consent.md`). |
| Location | **Yes** | Analytics events reach PostHog through our server, which sees the request's IP address. It is cut to a network and discarded, and postcode and coordinates are removed, but region-level location is derived from it, so this is declared rather than argued about. |
| Health information | No | |
| Financial and payment information | No | Nobody pays; there is no billing. |
| Personal communications | No | |

The three certifications are all true and all get ticked: data is not sold to third parties,
not used or transferred for any purpose unrelated to the single purpose above, and not used or
transferred to determine creditworthiness or for lending.

## The screenshots

`task store:screenshots` renders five 1280×800 PNGs into `apps/extension/store/screenshots`.
Three are rendered from the real components through the same component harness the IWFT suite
uses; two are captures of a real side panel, committed under
`apps/extension/store/sources/`. It is a separate Playwright config,
`playwright-shots.config.ts`, because these are not tests: they assert nothing, they write
files, and CI must not run them.

**Every shot is a benefit, said the positive way round.** The headline names what the reader
gets, never what their saved list is full of: the product is blunt with its reader, the
listing is not blunt about them. Each headline is two strings, and the second is set in
`--accent`; `breakAtSplit` puts them on a line each where the natural wrap would strand a
word.

| The shot | The gain | Where it comes from |
|---|---|---|
| `1-note` | All the info, less wait. | rendered: a sample note in the panel |
| `2-playlist` | Point it at a whole playlist. | capture: a real 204-video playlist |
| `3-time-saved` | Get your evenings back. | rendered: the web app at the one-hour milestone |
| `4-assistant` | Your whole library, one question away. | rendered: Settings › Connections, with a drawn conversation |
| `5-cooking` | Cook without the scrolling. | capture: cooking mode, mid-recipe |

**Why two are captures and not renders.** Cooking mode's controls sit below the dialog's own
box (`.content` is `min-height: 100%` plus its padding), so at this canvas's 800px the panel
cannot show the screen whole at any size, because a real side panel is taller. Its narration state,
"Waiting for you" and "Say it again", also needs the TTS pool, which the harness cannot
reach. The playlist preview's numbers are the whole point of that shot, and only a real
playlist has 205 videos, one skipped and 6.1 million tokens against them. Both are placed in
the same window as the rendered shots by `panelFrom`, at their own aspect, with a 12px radius
so a captured rectangle does not read as pasted onto a soft-cornered window.

**The content is the house account's samples**, fetched from `GET /api/samples` and committed
as `packages/app-core/playwright/store/sampleNotes.json`. That is the same set Start offers
and the home page shows (`docs/features/onboarding.md`, "Try a sample"), which settles the
question a store screenshot otherwise raises: invented notes would put made-up judgements in
front of real-sounding channel names. `task store:samples` refreshes the file; committing it
keeps the shots identical between runs.

**One window for all five**, at one height and one position, so the frame does not jump as the
listing is scrolled through. Its height is the one the real captures come at.

Three departures from what a reader would see, recorded here because a store screenshot that
misleads is a rejection:

- **The player bar is hidden** in the rendered note shots. Narration needs the TTS pool, so
  the bar reads "Read-along · no audio", true in the harness and false in a real install.
  Showing a bar that says the product has no sound would be the misleading option.
- **The page behind the panel is an abstraction**: a title bar and soft grey blocks, carrying
  no site's name, mark or layout. A mocked-up YouTube page would be a picture of YouTube,
  which the store's policies treat as someone else's branding.
- **The conversation in `4-assistant` is drawn**, in onboarding's own bubble styling
  (`OnboardingSlide.module.scss`), citing two notes that really are in the library the other
  shots are taken from. The capability is real and shipping (`docs/features/mcp-connector.md`);
  the assistant's own interface is not ours to photograph, and imitating one would be passing
  off.

Nothing inside a panel is scaled, recoloured or re-laid-out. The fonts are pulled from Google
Fonts in the rendered shots, because the app's `@font-face` rules ship in the extension's
`public/fonts.css`, which the harness never loads; they are the same two families
`tokens.scss` names.

**One line of `2-playlist` is painted out**, and it is the fourth departure: the playlist's
owner, a named individual. The playlist is public and the capture is factual, which is why it
was preferred to an invented one, but public is not the same as theirs to advertise with, and
a person's name on a commercial listing can read as an endorsement they never gave. `soften`
in `panelFrom` covers that one line in the panel's own ground. Nothing else is touched: every
count, label and control in the shot is the capture's own, so no claim the screenshot makes
has changed.

Blurring it was tried first and looked worse: a grey smudge under the title reads as a fault,
and it draws the eye to what was hidden. An organisation's playlist would need no edit at all:
the right of publicity and the personal-data question both attach to people, not companies.

## The icon and the promo tile

`task store:assets` renders both from the mark itself (`apps/extension/public/icons/icon.svg`),
so neither is a hand-made file that can drift from the brand.

- **`store-icon-128.png`.** The store asks for 96×96 of artwork inside a 128×128 square, with
  the remaining 16 a side transparent. The extension's own `icon128.png` is not that: its ink
  is 54×67 in the square, which is correct for a browser toolbar and renders small beside other
  listings in the store. This one scales the mark's own ink (18 by 22 units of its 32-unit box,
  not the box) until the taller side meets 96, then centres it. `artworkFit` does the sums and
  `scripts/storeAssets.test.mjs` holds them. The extension's icons are untouched.
- **`promo-tile-440x280.png`.** Shown on the store's category and search cards. The mark and
  wordmark, the listing's own headline, and the short description, on the same ground and grid
  as the screenshots.

The marquee tile (1400×560) is not supplied; it is only used if Google features the item, and
an empty slot costs nothing.

## The API credentials

Two values, both GitHub Actions secrets rather than Bitwarden's, for the reason
`FLY_API_TOKEN` already is: a runner can only read GitHub's secrets
(`docs/conventions/secrets.md` records the exception). Keep a copy in the `overview-prod`
Bitwarden project as well, because `task deploy:extension:publish` reads them from there.

| Secret | What it is |
|---|---|
| `CHROME_PUBLISHER_ID` | The publisher ID from Publisher › Settings in the dashboard |
| `CHROME_SERVICE_ACCOUNT_KEY` | The whole JSON key file of a Google Cloud service account |

**A service account, not an installed OAuth client.** The store's own API guide describes a
client id, secret and refresh token obtained through the OAuth playground, and v2 accepts
that too. It is the worse option here: the consent screen behind it issues refresh tokens
that expire after seven days while the screen is left in testing, so the job works, then
starts failing a week later with `invalid_grant` and no obvious cause. A service account has
no consent screen, nothing to rotate on Google's schedule, and is one secret rather than
three. It signs its own assertion with its key and exchanges that for an access token
(`signedAssertion` in `scripts/publishExtension.mjs`), which is why it cannot quietly expire.

Made once, as the account that owns the dashboard:

1. In Google Cloud, create a project and enable the **Chrome Web Store API** on it.
2. Create a service account. **It needs no roles and no permissions**: the store's dashboard,
   not Cloud IAM, is what grants it access. Name it for the publisher rather than for this
   job, because a publisher can register only one.
3. Create a JSON key for it and download the file.
4. In the dashboard, under Account, paste the service account's **generated address**,
   `name@project-id.iam.gserviceaccount.com` rather than a Gmail address, into **Service account**.
5. `gh secret set CHROME_SERVICE_ACCOUNT_KEY < the-key-file.json`, and
   `gh secret set CHROME_PUBLISHER_ID`, so neither is typed into a browser or left lying about.
   Delete the downloaded key file afterwards.

The item id is not among them: it is derived from the `key` already in
`apps/extension/manifest.json`, by the same `extensionIdFrom` that produces the origin
`CORS_ALLOWED_ORIGINS` names. The id the job submits to and the origin production vouches for
therefore cannot drift apart.

## What CI does

The `publish (extension)` job runs after `deploy`, on `main`, and only when the deploy job
reports that it created a tag, which is to say, only when the version number moved
(`docs/conventions/versioning.md`). A merge that ships no bump deploys the web app and sends
the store nothing, which is the existing rule and the right one.

The job then, in order: downloads the same artifact the release was built from, runs
`scripts/verifyRelease.mjs` against the merge commit again, reads the item's status, uploads
the store zip, submits it for review, and reads the item's status back. Every one of those is
a gate:

- **The store already publishes this version**: nothing is uploaded, and the job says so and
  passes. Re-running an old workflow therefore cannot resubmit anything.
- **Another version is already in review**, or is approved and waiting to be released: the
  job fails with what to do about it. The store would otherwise replace a submission that is
  halfway through review, and nobody should discover that from CI.
- **The store read a different version out of the zip than the one being tagged**: the job
  fails before submitting. The zip and the tag are the same build or there is no submission.
- **The store does not say it holds the submission afterwards**: the job fails. A publish
  call that answered is not a submission the store has; this repository has been bitten by
  exactly that shape before (`CLAUDE.md`, "Verify before reporting").

Without the four secrets, the first step warns and the rest of the job is skipped, the way the
TTS job behaves without its token. A release still happens; it simply is not sent anywhere.

Review is wall-clock nobody controls: usually hours, sometimes days, longer for an item
asking for host permissions. The job's success means *submitted*, never *live*. What it
actually became is on the item's page in the dashboard, and the store emails the publisher
contact address either way.

## What this does not do

- **Create the item, or change its visibility.** Neither is in the v2 API. The item exists;
  unlisted versus public stays a decision made in the dashboard, which is the right place for
  it.
- **Roll out to a percentage.** The API supports it (`deployInfos`) and nothing here uses it.
  With a handful of testers a staged rollout would be arithmetic on a number smaller than its
  own increments.
- **Cancel a submission.** `:cancelSubmission` exists; the job reports the jam and leaves the
  decision to a person, because cancelling something a reviewer may be halfway through is not
  a thing CI should decide.
- **Count installs.** Nothing tracks the listing, installs, or where an install came from.
  OV-186 is the card for first-run counting.
- **Watch the review.** Nothing polls for the outcome and nothing tells Trello. The store's
  email is the notification.
