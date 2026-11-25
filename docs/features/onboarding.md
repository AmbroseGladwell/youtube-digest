# Onboarding: around the first link

Cards: OV-46, then OV-327 (designs "OV-327 1–9", 327a–327ah; the decisions are on page 6 and in
the project's DECISIONS.md). This file says what each card settled.

A new reader pastes a link at Start. Onboarding reads it for free and shows it back to them,
then tells one story around it in six steps and three short moments: analytics, Your link,
Moment 1 (save anything), Topics, Moment 2 (your own AI knowledge base), Moment 3 (steps that
fit your life), About you, and the account. **Nothing that costs anything runs before the
account** (OV-327, decided 18 Nov 2026): the overview is written once the account exists, from
the answers given, while the reader waits on the wait screen, which opens the overview's own
page. There is no reveal, no plan screen and no voice question. **Seeing any overview needs
an account** (decided 28 Oct 2026).

## Analytics before the answer

The analytics question is the second screen, so the first is counted only if the queue
waits for the answer instead of discarding. It does, in memory only: `analytics-consent.md`,
"Before an answer".

## Nothing paid before the account

OV-327 (decided 18 Nov 2026). Signed out, onboarding reads the link and nothing that costs runs.
Each kind's run (`onboardingSources.ts`) reads its link first, for free, and shows it: the video
read (`POST /api/videos/read`, below), the page, or the episode. Then it waits on `waitToSpend`,
which settles once the reader has answered About you (or left the questions), has an account,
and their answers are moved into it (`answersIn`, `OnboardingRunRuntime`). Only then does
anything paid run: a transcript from our server, the episode's words or its transcribing, and
writing, straight into the account's library on the account's keys. `runOverviewGeneration` reads
topics and Settings just before it writes, so the overview is made from the answers.

**The video read** is one request for the card: the YouTube Data API's title, channel, length and
thumbnail, and the video's kind from the writer's own check (`checkNoteKind`), with the transcript
the check was made from. The kind is remembered per video for everyone, so a link anyone has pasted
costs nothing again; signed out the checks are capped at 300 a UTC day. The device keeps the
transcript and saves it into the account's store before writing, so `resolveVideo` finds it there
and our server never fetches it twice; writing takes the kind and skips its own check. No captions,
a check that fails or the day's cap: no kind, and writing checks as before. A video YouTube doesn't
list, or a read that fails, stops at the confirm step ("We couldn't find that video", or "We
couldn't reach YouTube just now" with Try again).

## Starter topics

`STARTER_TOPICS` (`packages/domain/src/starterTopics.ts`) is the 27 the topics screen offers,
in order, each with a description. Picking one makes it through find-or-create
(`useCreateTopicMutation`) with that description, and the sorting prompt already sends a
topic's description beside its name (`filingSection.ts`), so the description is what the
model sorts against.

**A description says what a topic includes, never what it leaves out.** The brief's
boundary rules were written as exclusions ("Nutrition goes in Health, not Food"), which
assume every reader has every topic and an overview sits in exactly one. Neither holds: a
reader picks some, and sorting allows "zero or more". A reader with Food but not Health
should still find a nutrition video under Food, so Health says "including nutrition" and
Food doesn't say "not nutrition".

Descriptions are hidden in onboarding, which shows the names alone, and shown as a quiet
hint under the name in the topic picker (46r), so a reader can see why something landed
where it did. A topic typed in by the reader, or made in the rail, has none and shows
none.

## Suggested topics

OV-176, design 175b. Above the full list, "For this video" (or article, or recipe), "suggested
from what it's about", offers up to three topics: starter ones, and at most one new one marked
New. They're offered, never picked for the reader, and pressing a starter one presses the same
chip in "All topics" below. A new one picked is made with no description, like a typed one.
With nothing to suggest the group isn't there and the screen is as before.

**Asked of a model as soon as the source is found** (`useTopicSuggestions`), not when the
screen opens. The fetch lands before or during the confirm screen, so the answer is usually back
before the reader reaches topics, and there's no wait. It's a small pass on our key on the
device's trial (`generateTopicSuggestions`, `POST /api/generations/topic-suggestions`), sent the
title and a video's description and transcript opening, or a page's opening: never counted as
the trial's overview, and capped on its own (`docs/architecture/tiers.md`). The starter topics
are deliberately broad, so the new one is **a more specific interest the source is clearly
about, and may sit inside a starter topic** (decided 5 Nov 2026): "Knife skills" within Food,
"Chess" within Gaming. That's where readers' real interests are. It's an interest a reader
would want a shelf for, not a tag ("Knife skills", not "Dicing onions"), and never the title,
a person or a brand. Code drops one that repeats a starter topic or runs past four words, and
a kept one takes the third place ahead of a third starter topic.

**Matched in code until the answer is in, and if it never is** (`suggestStarterTopics`,
`packages/domain`): each starter topic has a few `keywords`, matched as whole words against the
title (counting double) and the same text. A topic needs a word in the title, or two in the
text. Once the topics screen shows suggestions they're held, so an answer arriving late never
moves chips under the reader. `onboarding.topics.continued` counts how many were suggested and
how many of those were picked, and says by what (`suggestedBy`): the model; code, while its
answer was still on its way (`code-pending`) or because it failed (`code-failed`); code alone,
for a sample or shared copy, which doesn't ask (`code-only`); or nothing. `code-pending` is the
one to watch, since the design assumes the answer is usually back in time. A call refused for
a trial the server doesn't know is logged as `topic suggestions refused for an unknown trial`.

## Signed out sees no overviews

Where there are accounts, every page that would show an overview shows `SignedOutGate`
instead, with Create an account and Sign in, and nothing is made signed out on either key
(`docs/architecture/tiers.md`, "Signed out"). It replaced OV-103's 3-overview trial, the
signed-out library and its strips (`account-libraries.md`, "What signed out looks like").
On the web, onboarding's Start takes its place for a reader who has none.

Since OV-327 nothing is made signed out at all: onboarding's overview is written once the
account exists, as one of the plan's overviews on us ("Nothing paid before the account").

## Any kind of link

OV-154. Onboarding takes every kind of source the product reads, and stays in step as kinds
are added. Everything it does differently by kind comes from one table,
`onboardingSources.ts`, keyed on `Source["kind"]`: how a link given at Start is recognised,
using the same recognisers as the shell's own field; what the run makes from it; what the
Your link, the card and the wait call it. The table's
type and `onboardingSources.test.ts` both fail when `Source` gains a kind with no entry
(`source-identity.md`, "Adding a kind").

A playlist and a recipe aren't kinds of their own: a playlist is a way into a video, and a
recipe is a web page that turned out to hold one, so it's named a recipe once it has been read.

**Reading a link signed out.** An article is read by our server, which is otherwise only for
accounts. Signed out, the device's trial token reads it: 5 links a token (`TRIAL_READS`), and
15 a UTC day per address across every token, whatever the kind, a video's read included. A read is
counted whether or not the link could be read, since fetching it is the cost (decided 3 Nov 2026).
A TikTok has its entry, built but not yet offered at Start (`tiktok-links.md`, "Onboarding").

**A podcast episode** (OV-106) is an Apple Podcasts or Spotify link; a show's own episode page is
left to the web entry, which reads it as a page. Reading the link spends one of the trial's reads,
as an article's does (`reserveTrialRead`, shared by the read routes), and the card shows from the
read. Before the card shows, `POST /api/podcasts/transcript/check` asks whether its words can be
found, fetching none: on the trial signed out, answered as a new Free account would be, since the
episode is transcribed once there is one (`episodeWordsNotice`, designs 327v–327w-4). Found:
nothing is said. None: Your link says it'll make one from the audio and how much of the 5 free
hours that uses, and Looks right is the consent OV-305 asks for, so the wait transcribes without
asking and shows Transcribing the episode in place of Fetching transcript. A check that couldn't
tell says it may transcribe. Over 4 hours or no audio in the feed: a stop on Your link ("We found
the episode, but can’t make this one.", the reason in the warning colour, only Use a different
link), and the run ends there. The words themselves are found, or transcribed, only once there's
an account; if a check said found and was wrong, the wait transcribes (a new account has the
hours). A link our server can't use gets that reason's words at the confirm step
(`podcastLinkFailureCopy`), without "No overview was used.".

**The progress** keeps the link given and, once known, the source's key: the video's id from
the link or the playlist video chosen, or the article's once it has been read. Progress kept
before this held the video's address, and reads as that video.

**The screens by kind** (designs "OV-154 1–13", 154a–154n). Each entry in the table also gives
what these read:

- **The card (154d–154g, redrawn by 327s):** one card for every kind (`OnboardingSourceCard`):
  the image, or the site's name on a stone tile; a kicker naming the source and the kind ("The
  Harbour Post · Article", "Run Coach Ash · Video", "Sunday Kitchen · Recipe video"); the title;
  and the kind's facts on one line: "38:14 · YouTube", "26 min read · domain", "1 hr 25 min ·
  Serves 6 · domain", "1 hr 12 min · 10 Nov 2026 · from Spotify". Before the link is read the card
  shows the address with "Reading the page…". In the panel it is compact.
- **Your link's words** are the kind's own (`yourLink`); see "The flow on the web".

**When a page can't be used (154l–154n).** The failure shows at the confirm step, where the read
lands (`OnboardingReadFailure`, words in `onboardingFailureCopy.ts`). It has a short bar, what
happened, the link that was pasted, and a field for another.

- **The words are onboarding's own, not the paste field's.** They never say "nothing counted",
  since a trial read counts whether or not the page could be read. Instead the foot says the free
  overview hasn't been used.
- **A site that turns us away asks for another link.** It doesn't send a new reader to the
  extension, since installing it mid-onboarding leaves the answers half given. On a computer one
  line mentions the extension, for after the first overview.
- **No response adds Try again**, which reads the page once more.
- **A front page** is a page with nothing readable at a site's root.
- **Out of trial reads,** on the device or across the network, it says every link counts and to
  sign in or try again tomorrow, and neither counts down.

Another link given there replaces the first, and onboarding carries on from the same screen.

## The flow on the web

**Start is the home page** (327b). Signed out where there are accounts, `/` is the first-run
hero with "Make my overview", taking any link we can read ("Any kind of link"). The line under
the heading is the story: "Save what you care about, get an overview plus personalised actions,
and build a knowledge base you and your AI can use." The field asks for "a link to a video, page
or episode", with "YouTube, any web page, Apple Podcasts or Spotify." under it; anything else is
refused in place. The headline verb follows the deck's front card: Watch Less, Learn More, Cook
Easier, Listen Less. The deck holds the samples one of each kind in turn (`mixedByKind`) and opens
on a random card each visit. The link is saved as onboarding's progress and the reader goes to
`/start` (`OnboardingPage`).

**The steps** (327a): analytics (passed by where it was answered before), Your link, Moment 1,
Topics, Moment 2, Moment 3, About you, the account, then the wait. The stepper reads "Step n of 6"
(Start, analytics, Your link, Topics, About you, account); a moment shows the step of the screen
before it, and the wait has none. The moments, Topics and About you have Skip; Skip on Moment 3
or About you goes straight to the account. Back goes a screen back, and from the first screen to
Start. Every screen's heading takes focus as it arrives.

**The extension is offered only where it can be added** (`useExtensionOffered`): the web app in
desktop Chrome. Start's extension line, Moment 1's Add to Chrome, the wait's set-up and the next
steps under the overview all link to the Web Store listing in a new tab. On a phone, in another
browser and in the extension itself (panel or tab) none of them shows, and neither does Connect the
extension in the account menu.

**Your link** (327c, and 327s–327v by kind; `OnboardingYourLink`): one centred column on every
width. Their own card, the line "38 minutes from Run Coach Ash, turned into an overview you can
read in about 4, listen to in about 6, and share.", the Read · Listen · Share pills (Cook · Read
· Share for a recipe, which is read aloud step by step in cooking mode), one line for what's
inside, and "Saved to your library, ready for you and your AI." The minutes are worked out in
code (`expectedOverviewMinutes`): the writer's own note budget for a source that long
(`noteBudget`), plus a fixed allowance for the premise, claim, verdict and How to apply, at the
reader's reading and speaking rates. A video's length counts as spoken words at those rates; a
page's words are counted. Each kind's words come from `onboardingSources` (`yourLink`, `card`).
A playlist starts with its first available video, and "Choose a different video" picks another.

**The moments** (`OnboardingSavingMoment`, `OnboardingKnowledgeMoment`, `OnboardingStepsMoment`)
are fixed and illustrative: nothing is tailored live before the account. Moment 3 says "the
video", "the article" or "the episode", and a recipe's own line. On a phone the examples of
Moments 2 and 3 are a carousel (`OnboardingCarousel`, OV-411), so the page doesn't scroll: one
card at a time, Ask across your library first, swiped or chosen by its dot, moving on by itself
every 4.5 s. Touch or focus holds it, and its pause button stops it; with reduced motion it
starts paused. Wider, the cards sit side by side as before.

**Topics** (327e): up to three suggested for this source, pre-ticked until the reader presses a
chip; "Popular" shows eight (Finance stands in for the design's Money), and See all opens the 27
and a field for anything else. Wide, the pane beside is about topics and projects
(`OnboardingProjectsCard`); on a phone the same card sits under the chips. Topics are made on
Continue, a starter one with its description and a typed one with none.

**About you** (327i): "Make it yours." over the three-part sentence (`personalisation.md`), with
"You can update this anytime in Settings." and the line on where it goes. Wide, the pane shows
their card, the topics picked and Personalised once the sentence has something in it.

The fixed allowance (`FIXED_SECTION_WORDS`, 370) covers what a reader reads beside the key points and big picture the budget sizes: premise, core claim, How to apply, the steps, the verdict. Measured 20 Nov 2026 over the 60 overviews saved since 12 Nov: a median of 374 words beyond the budget, half between 164 and 478.

## The account

**The account screen** (327l) holds the way in itself (`RequestLinkFlow`'s `onboarding` variant):
First name (optional), Email, the terms line, Create account, "No card needed. Free includes 5
overviews a month." and "Already have an account? Sign in", which switches in place. Beside it
(below on a phone), "Saved with your account": their card, the topics and Personalised as pills,
and the Read · Listen · Share pills, then "What you get". Email only for now.

**The code, first** (327l-2): once the email is sent, the same screen takes the 8-character code
from the mail, which submits itself once eight characters are in; "Or tap the link in the email"
is the backup (`EnterCode`'s `codeFirst`; the mail itself is in `sign-in.md`, "A code in the web
mail"). In the extension the link's page shows the code, as before.

**The magic link may open in another tab.** The progress is kept on the device
(`overview.onboarding.v1`), and home sends a reader with progress back to `/start`. Once signed in
from the account screen the run's tab goes to the wait.

## The wait

327m, live on page 7 (`OnboardingWaitScreen`, `OnboardingWait`, `waitStages.ts`). The first paid
screen: their card, then each stage of the run with the logo mark as its loader, from the run's
real events (the words the source was found to hold, writing begun, the overview in the
account): Fetching transcript, then Creating overview for a video; the page, the recipe or the
episode for the other kinds. Only the line under the writing stage is a timed script, spread over
the expected time, and the bar creeps by elapsed time and completes only when the overview is
in. "You can switch tabs but keep this tab open" stands under it, a `beforeunload` prompt holds a
running tab, and the tab's title becomes "Ready: …" once it's done (`useKeepTabWhileRunning`).
Beside it (below on a phone), set-ups to do meanwhile that never move by themselves
(`OnboardingSetups`): Appearance exactly as Settings, the extension where it can be added, and
Connect your AI, each opening in a new tab. When it's ready the screen changes in place, the card
fills in with its topics, Personalised and pills, and Open your overview goes to the overview's
page; nothing jumps on its own. A failure says so with Try again. A shared copy or a sample has
nothing to wait for and opens as soon as it's in the account.

## The run lives in one tab

OV-163. The run is made above the router (`OnboardingRunRuntime`, in `App`), so the page coming
and going never starts the overview over: the web's sign-in lands on home and comes straight
back, and going home mid-run comes back too. Before this the page owned the run, and either
would have cancelled a generation in flight and started another.

**One tab has it.** The tab that started onboarding writes its own id into the progress
(`runner`, from `overview.onboarding.tab.v1` in session storage, so a reload is the same tab).
Another tab with the same progress, the sign-in link's for instance, runs nothing: it asks
over a `BroadcastChannel` whether that tab still has the run, every three seconds, and mirrors
the phase it answers with (`useOnboardingRunOwner`). When nothing answers within a second and a
half, that tab has gone, and the asking tab takes the run over by writing its own id, which
the first tab, if it's merely slow, sees and yields to. Try again from a mirroring tab takes
the run over the same way, so the retry runs where it was pressed. Progress from before this
names no runner, and the first tab to ask and hear nothing takes it.

**Where a run writes.** Into the account's library, always: the run waits for the account before
it writes (OV-327), so there is nothing to move in afterwards, and the no-account library isn't
opened for it. A run started signed in, or a retry after the account exists, starts writing as soon
as its link is read.

**The wait opens the overview's own page.** Onboarding forgets its progress and dismisses the
move notice as it goes there. Under the Verdict of that overview, and no other, the next
steps (46l): Save in one click and Ask your AI with Connect your AI. Each has ×; which were
dismissed is kept on the device (`overview.nextSteps.v1`). The library then shows the
first-overview milestone (46m, `time-saved.md`).

## From a shared page

OV-152. A visitor who chooses **Save to my overviews** on a shared page (`sharing.md`)
goes through onboarding with the shared copy as its overview, instead of straight to an
account. Nothing is made: the copy travels in onboarding's progress, beside the share's
token, so there is no Your link and no wait (OV-327). The other screens are the same: the
moments and questions, then the account screen with the copy's card, and the copy opens as soon
as it's in the account.

**The answers don't rewrite the copy.** Topics and About you are saved for every
overview after it. The copy itself is someone else's note, so it isn't sorted or written
for the reader.

**It's saved once the account's library is open**, not before. The share's token goes to
the server first, so the copy's push is let in uncounted (`tiers.md`, "Reserving on the
reader's own key"). If the account already holds that overview, it's left as it is.

**Back from the first screen returns to the shared page**, with a full load, since the copy
is read from the document the server writes.

The aside's pasted link starts onboarding exactly as Start's field does, and the page's
other ways in go to Start.

## Try a sample

OV-155. Start offers a few ready-made overviews below the link field, on the web and in the
panel, so a new reader can begin without leaving to find a link. **Choosing one starts onboarding
around it exactly as Save to my overviews does around a shared copy** ("From a shared page"):
there's no Your link, no run and no wait (OV-327). The moments and questions are the same, then
the account screen with the sample's card, and the sample opens as soon as it's in the account.

**Samples are shares.** Each is a live share owned by a house account (decided 4 Nov 2026), so
it's made, replaced and stopped the way any share is (`sharing.md`), and nothing new is stored.
`SAMPLE_SHARE_TOKENS` lists their tokens in the order Start offers them
(`docs/architecture/api.md`), so samples change without a release. `GET /api/samples`, signed
out, lists each one's note without its transcript or narration. `GET /api/samples/:token` gives
the whole copy once one is chosen, and only for a listed token. A listed token that isn't live
is left out and logged as `sample missing`. Neither counts a visit to the share.

**Refreshing a sample** after a prompt change: as the house account, ⋯ Regenerate it, then Share
again. The overview keeps its id and sharing again replaces the copy behind the same link, so the
token in `SAMPLE_SHARE_TOKENS` stays. A sample is "written for anyone", so the house account's
About you and learned items must be empty first, or its profile shapes the note. The house
account is on Plus (9 Nov 2026), so a refresh has room on our key.

**A sample is free.** It's saved through its share token, so the push is let in uncounted
(`tiers.md`, "Reserving on the reader's own key"), and it isn't one of the plan's overviews on
us. A few live shares are far below an account's limit of 50.

**Back from the first screen goes to Start**, not to a shared page: the progress marks the copy
as a sample (`share.sample`).

**The designs** are "OV-155 1–13" (155a–155l), with 155l, the sample deck, the interactive one.

**On the web, Start's samples are a deck** (`SampleDeck`, 155l), in the Example overview card's
place, which goes. One full card with two blank ones behind: the image, "Source · Kind ·
length", the title, then the Premise (a recipe's Summary), the next sections drawn as blurred bars
marked Written, and Open this sample. Never the verdict or anything past the Premise, since a
sample is unlocked by making an account like any first overview.

- **It cycles every 6 seconds**: the front card slides away and fades, the next comes forward
  (480ms). Hovering over it or focusing inside it holds it. Pause stops it for the visit, and the
  arrows step by hand and restart the clock. "Sample N of M" is announced only after a manual step.
  With reduced motion it doesn't cycle until Play, and changes don't move.
- **The headline's verb follows the front card**: Watch Less for a video, Learn More for an article,
  Cook More for a recipe (`StartVerb`), rolling up out of a clipped line. "with The Overview"
  never moves.
- **See all N samples** lays the deck out as rows in deck order, front card first, the front card
  folding down as the others slide out from under it. Show one at a time folds it back.
- **On a phone** the cards are narrower so the two behind fit, and a swipe either way past 70px
  throws the front card off that way and brings the next.
- Only the front card is in the tab order while the deck is stacked.

Fewer than three samples aren't a deck: they're rows, as in the panel. With none, the group hides
and Start keeps the Example overview card: a server with none listed, one that doesn't answer, or
a shell with no server.

**In the panel the deck is the same deck** (205g), in the phone's geometry, under Make my
overview and Sign in. Fewer than three are rows there too (`OnboardingSamples`, 155d): the image
beside the title, "Source · Kind" above it and the length below, three at a time, with More
samples opening the rest in place and moving focus to the first of them.

**Opening one (155f).** The choice is counted as it's pressed, so a failed open still records it.
Nothing changes for 300ms; then the card says "Opening…" with aria-busy (in place of Open this
sample on the deck, or of the length on a row), and the deck stops cycling. If the copy can't be
fetched, "That sample couldn't be opened. Try another, or paste a link." shows above the samples,
focus returns to the card, and the deck stays paused with it in front.

**Through onboarding (155g–155k, then OV-327).** A sample is already made, so there is no Your
link, run or wait: the moments and questions, then the account, and the sample opens once it's in
the account. Its overview page carries no sample label; under How to apply it says "Written for
anyone, like every sample. The overviews you make are written for you." The first of its next steps is **Now try your own**, with its own field, which starts the next overview as the
library's own field does, and hides when there's no way to make one. The next steps record that
it was a sample (`overview.nextSteps.v1`'s `sample`).

**A sample is sorted into the reader's topics where it fits any** (owner, 5 Nov 2026). As it's
saved into the account, `POST /api/generations/topics` matches its note against the account's
topics on us: a small pass with no transcript, that never adds a topic and doesn't
count against the plan. It waits for the topics picked in onboarding to reach the account. With no
topics, or if the pass fails, it's saved unsorted. A copy saved from a shared page still isn't
sorted, and the preview still says Unsorted until the sample is in the account.

**A sample isn't the reader's first overview** (owner, 5 Nov 2026). It's saved with `fromSample`,
one of the fields a share never carries, and the library's first-overview milestone (46m) counts
only overviews without it, so it waits for the first one they make.

## Every Create account

OV-155. Where there are accounts, no new account skips onboarding. `/create-account` is a
redirect: to onboarding already under way, or else to Start, and that covers every way in at once,
including the account menu, the signed-out gate, sign-in's "Create an account", Settings, plan usage, the
saved-locally note, and the extension's injected button and article menu. In the panel, once the device has had an
account, home leads with signing back in (46q), so the redirect asks home for Start instead.
The create-account form itself is onboarding's account screen (46j). A shell with no server
keeps design 9b's page (`sign-in.md`, "Creating an account").

Start says why it isn't a form (155e). On the web a stone note above the hero reads "New accounts
start with your first overview".

**In the panel there is no Create account at all** (205g-4). Start's own lead says the first
overview makes the account, so nothing there needs a second route and sign-in's switch line is
"New here? Your first overview sets up your account." in a link's place. The gate's "Create an
account" still goes through the redirect, which lands on Start, and 205d-5's lone back chevron
on Start is retired with it: a reader who wants to sign in presses Sign in, and the bar holds
the way back from there.

## In the extension panel

The same screens at 400 × 720 (designs 46n–46q and 205g–205g-4), with the narrow layout throughout.

**Start is the web's Start, compressed** (205g, `StartHero` in `HomePage.tsx`), drawn tall so
the panel scrolls below 720. In order: the headline, the lead, the way to make an overview,
`Sign in` as a full-width button, then the samples.

- **The headline's verb follows the tab** (`useStartSubject`): "Watch Less," for a video,
  "Learn More," for a page. With nothing on the tab it follows the deck's front card and cycles
  with it, as on the web (155l). A page is "Learn More," whatever it turns out to be, because we
  don't read one until Create, so "Cook More," can only arrive from a recipe in the deck.
- **The lead says the first overview makes the account**: "Make this video|page your first
  overview. We'll set up your account as we go." With nothing on the tab it asks for a link and
  says the same.
- **Beside something, Start shows the same offer card as signed in** (`SourceOffer`, 205a):
  source · kind and the title, never a length or a reading time, which a page's isn't until it
  is read. A video's channel and title come from the captions noticing it fetched anyway; before
  they land there is no card, and the lead still says what will be made.
- **"Or paste a different link"** puts the field back in the offer's place. The design doesn't
  draw it, but without it a reader beside a video has no way to give another link, and `+ New`
  is hidden signed out.
- **The page is read in the browser**, as signed-in capture reads it (`article-panel.md`).
  Chrome is asked inside the press (`pageAccess.ts`), so the read spends no trial read and isn't
  turned away by the site; without access it falls back to our server on the trial. Only a page
  with a path is offered (`isOfferedPage`): a site's front page is a list of other stories.

The video itself is first shown on the next screen once it has resolved, since the panel knows
only its address until then. Headings are set smaller, and About you's sheet takes the panel
over (141g).

**The account is made with a code**, as the extension always signs in (`sign-in.md`): the
link opens in the browser, which shows a code to type into the panel. Then the plan, and the
overview on the panel's own reader. Its next steps are Ask your AI alone: the panel is the
extension already, so Save in one click has nothing to offer there.

**Signed out once the device has had an account** (46q), the panel's home offers signing
back in instead of Start: "Sign in to see your overviews", with Sign in first and Create an
account under it, which opens home as Start. A device is marked when it is signed in
(`overview.accountSeen.v1`, only that it happened). Every other page that would show an overview
shows the same. **Sign in reached from Start** carries `fromStart`, and the bar holds the way
back named after what home is about (`useHomeName`, 205g-4); reached from the gate it carries
none, so the gate offers no way back to itself.

## Into the account

Topics, About you and the voice are written into the no-account library while signed out. On
sign-in, `moveAnswersInto` brings every topic in with its description, and About you and the
voice where the account has none (the account's own win) (`account-libraries.md`, "The move on
sign-in"). The overview waits for that move (`answersIn`) and is written straight into the
account (OV-327). The analytics answer carries in as it always has.

## Analytics

`onboarding.*`: the link given at Start, with its kind (video, playlist or article; a recipe
isn't known until it's read), or refused; the sample chosen, by where it sat in the list and its
kind, never its title or link; each screen shown, skipped or gone back from (the moments are
screens of their own: `saving`, `knowledgeBase`, `stepsForYou`); the video being the wrong one or
another of a playlist's chosen; how many topics were picked and typed; how many entries each
section of About you holds and how many were typed, never what they say; the overview failing, on
which screen, and whether the account already existed (`afterAccount`), and being tried again;
the way to an account; the sign-in landing (`account.landed`); the overview arriving in the
account after that (`overview.arrived`), with how many seconds the reader waited; opening it, and
whether it was made from a link or saved from a sample or a shared page; and a next step followed
or dismissed. The landing and the arrival are recorded in the progress (`landed`) so a page that
comes back counts each once. The run itself is counted as `capture.newOverview.started` with
`from: "onboarding"`.

## Not built yet

- "Vote for what's next", the unsorted reveal prompt.
- Open from 155: the deck's cycle time (6 seconds, the design's default).
- OV-327's `kind` property on every onboarding event, the set-up cards' and the wait's own events, and the soft wall (round 4).
