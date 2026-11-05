# Onboarding: inside the first overview

Card: OV-46. Designs: "OV-46 1 Start and Questions", "OV-46 2 Account Plan and Reveal" and
"OV-46 3 Panel and Afterwards" (46a–46s), with About you replaced by OV-141 (141a–141j). Built
as stacked PRs; this file says what each one settled, and grows with them.

A new reader pastes a link and the overview starts at once. While it is made they answer,
or skip, a few questions that shape it: analytics, the video, topics, about you and a
voice, with a slide after each to show what it buys. Then they create an account, choose a
plan, and see the overview. **Seeing any overview needs an account** (decided 28 Oct 2026):
signed out, a reader can start their first overview, and nothing else.

## Analytics before the answer

The analytics question is the second screen, so the first is counted only if the queue
waits for the answer instead of discarding. It does, in memory only: `analytics-consent.md`,
"Before an answer".

## Writing waits for the answers

`runOverviewGeneration` reads topics and Settings once, just before it writes, so anything
chosen after that would miss the first overview. Onboarding passes `waitToWrite`: the run
resolves the video and fetches the transcript straight away (so the "Is this the right
video?" screen has something to show, and a transcript that can't be had fails early), then
waits on that promise before reading topics and Settings and writing. The flow settles it
when About you is answered, or when the reader leaves the questions some other way. With an
empty sentence it waits through the slide after About you too, because that slide offers the
sentence once more and anything added has to reach the first overview. Other runs pass nothing
and write at once, as before.

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
moves chips under the reader. `onboarding.topics.continued` counts how many were suggested, by
the model or in code, and how many of those were picked.

## The library slide

OV-177, design 175c. "A library that sorts itself" says how sorting works: "As each overview
is written, we check it against your topics and add it to the ones it fits best, if any"
(`filingSection.ts`). Its scene is the reader's own: their video or page, "not written yet",
and their topics, the first five then "and N more". It claims no result, since nothing is filed
until it's written, so there's no "+1 arriving"; the real filing shows in the preview once
written. With no topics it says overviews wait in Unsorted until they add one. A sample or a
shared copy is already written, so its card says "not sorted yet". The scene stays hidden from
screen readers; the sentence carries the meaning.

## Signed out sees no overviews

Where there are accounts, every page that would show an overview shows `SignedOutGate`
instead, with Create an account and Sign in, and nothing is made signed out on either key
(`docs/architecture/tiers.md`, "Signed out"). It replaced OV-103's 3-overview trial, the
signed-out library and its strips (`account-libraries.md`, "What signed out looks like").
On the web, onboarding's Start takes its place for a reader who has none.

What stays is what onboarding's overview needs. Its run is made on us through the device's
trial token, which the server now allows one overview (`TRIAL_OVERVIEWS`), behind the same
cap per address and signed-out share of the day. It is saved to the no-account library,
unseen, and the move on sign-in carries it into the account, where it counts as one of the
plan's overviews on us.

## Any kind of link

OV-154. Onboarding takes every kind of source the product reads, and stays in step as kinds
are added. Everything it does differently by kind comes from one table,
`onboardingSources.ts`, keyed on `Source["kind"]`: how a link given at Start is recognised,
using the same recognisers as the shell's own field; what the run makes from it; what the
confirm screen, the preview, the teaser's byline and the progress line call it. The table's
type and `onboardingSources.test.ts` both fail when `Source` gains a kind with no entry
(`source-identity.md`, "Adding a kind").

A playlist and a recipe aren't kinds of their own: a playlist is a way into a video, and a
recipe is a web page that turned out to hold one, so it's named a recipe once it has been read.

**Reading a link signed out.** An article is read by our server, which is otherwise only for
accounts. Signed out, the device's trial token reads it: 5 links a token (`TRIAL_READS`), and
15 a UTC day per address across every token, apart from the trial's one overview. A read is
counted whether or not the page could be read, since fetching it is the cost; it never spends
the overview, so a wrong paste, a paywall or a front page doesn't use up a reader's only try
(decided 3 Nov 2026). Podcasts and reels join the table when they ship.

**The progress** keeps the link given and, once known, the source's key: the video's id from
the link or the playlist video chosen, or the article's once it has been read. Progress kept
before this held the video's address, and reads as that video.

**The screens by kind** (designs "OV-154 1–13", 154a–154n). Each entry in the table also gives
what these read:

- **Is this the right one? (154d–154g):** one card for every kind (`OnboardingSourceCard`):
  - the image, or the site's name on a stone tile;
  - a kicker naming the source and the kind ("The Harbour Post · Article");
  - the title, and facts that belong to the kind: "By … · 14 min read" for an article, the page's
    own Prep, Cook, Total and Makes for a recipe, never summed.

  The heading says the kind's noun and takes focus again when it changes. Before the page is
  read it says "page", and the card shows the address with "Reading the page…". A recipe changes
  only the words and the facts, never the layout. A playlist keeps its lower row, because there's
  a choice inside it. In the panel the card is compact, with the image beside the title.
- **The preview (154h):** the same card made small, then the kind's sections. A recipe's are
  Summary, Ingredients and Method, and the last two say "From the page" once it's read, because
  they're the page's own.
- **The progress line (154i):** "Reading the page" in place of "Fetching the video". Every later
  stage reads the same for every kind.
- **The teaser (154j, 154k):** "The Harbour Post · Article · 14 min read" or "… · Recipe · 1 hr
  5 min", then the first section (Premise, or a recipe's Summary), and a last line naming what an
  account opens for that kind. On a wide screen it sits in the preview beside the account screen;
  narrower, above it.

**When a page can't be used (154l–154n).** The failure shows at the confirm step, where the read
lands (`OnboardingReadFailure`, words in `onboardingFailureCopy.ts`). It has a short bar, what
happened, the link that was pasted, and a field for another, and the preview waits for a link it
can read.

- **The words are onboarding's own, not the paste field's.** They never say "nothing counted",
  since a trial read counts whether or not the page could be read. Instead the foot says the free
  overview hasn't been used.
- **A site that turns us away asks for another link.** It doesn't send a new reader to the
  extension, since installing it mid-onboarding leaves the answers half given. On a computer one
  line mentions the extension, for after the first overview.
- **No response adds Try again**, which reads the page once more.
- **A front page** is a page with nothing readable at a site's root.
- **Out of trial reads,** on the device or across the network, the field asks for a video link,
  since those use none. The network's says to try a page tomorrow, and neither counts down.

Another link given there replaces the first, and onboarding carries on from the same screen.

## The flow on the web

**Start is the home page.** Signed out where there are accounts, `/` is the first-run hero
with "Make my overview" (46a), taking any link we can read ("Any kind of link"). It asks for "a
link to a video or a page" (154a), the two shapes every kind arrives in, so the hint doesn't go
stale as kinds are added. Anything else is refused in place: "That doesn't look like a link we
can read. Try the address of a video or a web page." The shared page's Make your own says the
same (154c). The link is saved as onboarding's progress and the reader goes to `/start`
(`OnboardingPage`), which the shell renders without its masthead. A playlist starts with its
first available video, and "Choose a different video" picks another; the playlist isn't
followed. Below the field Start offers samples ("Try a sample").

**The screens:** analytics (46b, passed by where it was answered before), Is this the right
video? (46c), topics (46d), A library that sorts itself (46e), About you (141a), Steps that fit
around you (141j), the voice (46g), Ask your AI (46h), More sources on the way (46i), the account
(46j) and the plan (46k). Topics, the four slides, About you and the voice have Skip, which keeps the default. Back
goes a screen back, and from the first screen back to Start. "Use a different link" goes back
to Start and forgets the progress. Every screen's heading takes focus as it arrives.

**Two layers at the top.** The overview's own progress says what the run is doing, and
**shows no bar until writing starts** (OV-175, designs 175a–175l), so it never looks stalled.
While fetching it's a spinner and "Fetching the video…" or "Reading the page…". Once the
source is in hand it's a calm line: "Transcript ready" (or "Page read", "Recipe read") and
"Writing starts in a few taps", which becomes "…when you continue" on the screen whose
Continue lets writing go. That line says what's done and nothing about the reader, and names
no screen (it replaced OV-164's "Writing starts once you've told us about you"). The bar
appears when writing starts, then becomes See your overview, which goes straight to the
account from whatever screen the reader is on. A failure says so on that screen, and the
account screen offers Try again. The bar is drawn by stage, not measured: writing is one
stage. Below it, fourteen segments say where the reader is in the story, Start and the
reveal included.

**The preview on a wide screen.** From 64rem the screens and the preview are one centred
pair with a fixed 40px gap, the preview level with the screen's heading, so the halves don't
drift apart on a wide window. Before writing, the preview lists what writing waits on: the
source, Topics, Written for you, then Writing ("Starts after these"). The row the current
screen feeds is marked Now (confirm, topics, About you; never a slide), and answers land in
their rows as they're given: picked topics as they're pressed, up to four and "+N", and
"Personalised" once the sentence has something in it, never the sentence itself. Topics
say what happens to them, never where this overview will be filed. On the confirm screen the
source card isn't repeated in the preview; it arrives there on Looks right. When writing
starts the rows fold into pills (topics, Personalised or Written for anyone, the voice) and
the bar appears over the kind's sections, Chapters included, then "Topic" shows where it was
sorted once written. A failure before the source is in hand leaves "Nothing to make yet"; one
while writing says so in the preview, with Try again. Never the overview's text.

**About you** is a sentence to finish (`personalisation.md`), with What this changes showing a
fixed before-and-after under it. Continue saves it before writing is let go. The screen says it
goes through our server to OpenAI on us.

**Steps that fit around you** follows it with a fixed example about sleep and the reader's own
sentence quoted, never their overview's text. With an empty sentence, whether skipped or
continued through, it becomes "Let's make your overviews personal and actionable" with
Personalise my overviews back to the sentence, and the progress line drops "for you".

**Topics** are made on Continue, not as chips are pressed, so pressing one off again leaves
nothing behind. A starter topic is made with its description; a typed one with none.

## The account

**The account screen** shows the overview's title and Premise and nothing else of it: the
rest is drawn bars under a fade, not its text, so none of it is in the page before an account.
It can't be passed without one. Its ways in wait until the overview is made, so the overview
is in the no-account library before the account exists. Email only for now; Google and Apple
are a later card. "Continue with email" and "Already have an account? Sign in" open the
existing email flow in place.

**The magic link may open in another tab.** The progress is kept on the device
(`overview.onboarding.v1`), and home sends a reader with progress back to `/start`, signed out,
or signed in with an overview made. A sign-in link can only return to a consent screen, so it
lands on home and home sends it on.

**The plan** (46k) follows a new account; signing in to one already held skips it. Free and
Plus are the same card; Plus says Coming soon until there is billing, and BYO Plus is a line
under them. Continue with Free waits until the move has brought the overview into the account,
then goes to it. "This overview counts as your first of the month."

**The reveal is the overview's own page.** Onboarding forgets its progress and dismisses the
move notice as it goes there. Under the Verdict of that overview, and no other, the next
steps (46l): Save in one click with Add to Chrome, which stays disabled until the extension
is in the Web Store, and Ask your AI with Connect your AI, which opens Settings ›
Connections. Each has ×; which were dismissed is kept on the device (`overview.nextSteps.v1`). How to apply
there carries Written for you / For anyone (`personalisation.md`).
The library then shows the first-overview milestone (46m, `time-saved.md`).

## From a shared page

OV-152. A visitor who chooses **Save to my overviews** on a shared page (`sharing.md`)
goes through onboarding with the shared copy as its overview, instead of straight to an
account. Nothing is made: the copy travels in onboarding's progress, beside the share's
token, so there is no "Is this the right video?" screen and no run. The story is a segment
shorter. The other screens are the same: the questions and slides, then the account screen
with the copy's title and Premise, the plan, and the copy as the reveal.

**The answers don't rewrite the copy.** Topics, About you and the voice are saved for every
overview after it. The copy itself is someone else's note, so it isn't sorted or written
for the reader, and the preview says Unsorted.

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
there's no "Is this the right one?" screen and no run. The questions and slides are the same,
then the account screen with the sample's title and Premise (or a recipe's Summary), the plan,
and the sample as the reveal, saved into the new account as the reader's own. The answers
apply from the next overview on.

**Samples are shares.** Each is a live share owned by a house account (decided 4 Nov 2026), so
it's made, replaced and stopped the way any share is (`sharing.md`), and nothing new is stored.
`SAMPLE_SHARE_TOKENS` lists their tokens in the order Start offers them
(`docs/architecture/api.md`), so samples change without a release. `GET /api/samples`, signed
out, lists each one's note without its transcript or narration. `GET /api/samples/:token` gives
the whole copy once one is chosen, and only for a listed token. A listed token that isn't live
is left out and logged as `sample missing`. Neither counts a visit to the share.

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

**In the panel, samples are rows** (`OnboardingSamples`, 155d), after Make my overview and before
"Already have an account? Sign in", three at a time: the image beside the title, "Source · Kind"
above it and the length below. More samples opens the rest in place and moves focus to the first of
them; nothing scrolls sideways. On a tab with nothing to read the lead points to both ways in.

**Opening one (155f).** The choice is counted as it's pressed, so a failed open still records it.
Nothing changes for 300ms; then the card says "Opening…" with aria-busy (in place of Open this
sample on the deck, or of the length on a row), and the deck stops cycling. If the copy can't be
fetched, "That sample couldn't be opened. Try another, or paste a link." shows above the samples,
focus returns to the card, and the deck stays paused with it in front.

**Through onboarding (155g–155k).** A sample is already made, so the overview's progress line
doesn't show and there is no See your overview: the way to the account is through the screens. On a
wide screen the preview shows it with every section Written and the line "Written for anyone. The
overviews you make are written for you." The teaser says "Your sample overview is ready", and the
plan "Your sample overview is ready." and "This sample doesn't count towards your month. The first
overview you make will." The reveal carries no sample label; under How to apply it says "Written
for anyone, like every sample. The overviews you make are written for you.", and the Written for
you / For anyone flip doesn't show, so nothing is written for anyone either. The first of its
next steps is **Now try your own**, with its own field, which starts the next overview as the
library's own field does, and hides when there's no way to make one. The next steps record that
it was a sample (`overview.nextSteps.v1`'s `sample`).

**A sample is sorted into the reader's topics where it fits any** (owner, 5 Nov 2026). As it's
saved into the account, `POST /api/generations/topics` matches its note against the account's
topics on us: a small pass like For anyone, with no transcript, that never adds a topic and doesn't
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
start with your first overview". In the panel the lead says "New accounts start with your first
overview. Make one of this video, or try a sample.", and on a device that has had an account a
Back button returns to signing in.

## In the extension panel

The same screens at 400 × 600 (designs 46n–46q), with the narrow layout throughout.

**Start offers the video the panel is beside** (`PanelStart`, 46n): "Make an overview of
this video", "Make my overview", "Or paste a different link" for a field in place, and
"Already have an account? Sign in". **Beside a page** (154b) it says "Make an overview of this
page" and shows what the tab gives, its address and title, since an article can't be told from a
recipe before it's read. The page is read in the browser, as signed-in capture reads it
(`article-panel.md`). Chrome is asked inside the press (`pageAccess.ts`), so the read spends no
trial read and isn't turned away by the site; without access it falls back to our server on the
trial. **On a tab with nothing to read** it says "Paste a link to start", and the field is the
way in. The video itself is first shown on the next screen once it has
resolved, since the panel knows only its address until then. Headings are set smaller, and
About you's sheet takes the panel over (141g).

**The account is made with a code**, as the extension always signs in (`sign-in.md`): the
link opens in the browser, which shows a code to type into the panel. Then the plan, and the
overview on the panel's own reader. Its next steps are Ask your AI alone: the panel is the
extension already, so Save in one click has nothing to offer there.

**Signed out once the device has had an account** (46q), the panel's home offers signing
back in instead of Start: "Sign in to see your overviews", with Sign in first and Create an
account under it. A device is marked when it is signed in (`overview.accountSeen.v1`, only
that it happened). Every other page that would show an overview shows the same.

## Into the account

Topics, About you, the voice and the overview are written into the no-account library while
signed out. On sign-in, `moveAnswersInto` brings every topic in with its description, and
About you and the voice where the account has none (the account's own win), before
`moveLibraryInto` brings the overview (`account-libraries.md`, "The move on sign-in"). The
analytics answer carries in as it always has.

## Analytics

`onboarding.*`: the link given at Start, with its kind (video, playlist or article; a recipe
isn't known until it's read), or refused; the sample chosen, by where it sat in the list and its
kind, never its title or link; each screen shown, skipped or gone back
from; the video being the wrong one or another of a playlist's chosen; how many topics were
picked and typed; how many entries each section of About you holds and how many were typed,
never what they say; See your overview before the end; the overview failing, and on which screen, and
being tried again; the way to an account; the plan; the reveal, and whether its overview was made from a link or saved from a sample or a
shared page; and a next step followed or
dismissed. The run itself is counted
as `capture.newOverview.started` with `from: "onboarding"`.

## Not built yet

- "Vote for what's next", the unsorted reveal prompt.
- Open from 155: the deck's cycle time (6 seconds, the design's default) and a random first card.
