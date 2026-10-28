# Onboarding: inside the first overview

Card: OV-46. Designs: "OV-46 1 Start and Questions", "OV-46 2 Account Plan and Reveal" and
"OV-46 3 Panel and Afterwards" (46a–46s). Built as stacked PRs; this file says what each
one settled, and grows with them.

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
when About you is answered or skipped, or when the reader leaves the questions some other
way. Other runs pass nothing and write at once, as before.

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

## The flow on the web

**Start is the home page.** Signed out where there are accounts, `/` is the first-run hero
with "Make my overview" (46a), taking a video or playlist link; anything else is refused in
place. The link is saved as onboarding's progress and the reader goes to `/start`
(`OnboardingPage`), which the shell renders without its masthead. A playlist starts with its
first available video, and "Choose a different video" picks another; the playlist isn't
followed. "Try a sample" waits on which samples to offer.

**The screens:** analytics (46b, passed by where it was answered before), Is this the right
video? (46c), topics (46d), A library that sorts itself (46e), About you (46f), the voice
(46g), Ask your AI (46h), More sources on the way (46i), the account (46j) and the plan (46k).
Topics, the three slides, About you and the voice have Skip, which keeps the default. Back
goes a screen back, and from the first screen back to Start. "Use a different link" goes back
to Start and forgets the progress. Every screen's heading takes focus as it arrives.

**Two layers at the top.** The overview's own progress says what the run is doing: fetching,
waiting for About you, writing, then See your overview, which goes straight to the account
from whatever screen the reader is on. A failure says so on that screen, and the account
screen offers Try again. The bar is filled by stage, not measured. Below it, thirteen
segments say where the reader is in the story, Start and the reveal included. On a wide
screen the progress sits in a preview beside the screens, with the video and its sections
marked Waiting, Writing or Written, and the topics it was sorted into: never the overview's
text.

**About you** is design B with A as an inset: one thing they do and up to two things to get
better at build a line ("Works in healthcare, learning about cooking."), or their own words,
at most 140 characters, take its place. Continue saves it as `Settings.readerContext` before
writing is let go. The screen says it goes through our server to OpenAI on us.

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
move notice as it goes there.

## Into the account

Topics, About you, the voice and the overview are written into the no-account library while
signed out. On sign-in, `moveAnswersInto` brings every topic in with its description, and
About you and the voice where the account has none (the account's own win), before
`moveLibraryInto` brings the overview (`account-libraries.md`, "The move on sign-in"). The
analytics answer carries in as it always has.

## Analytics

`onboarding.*`: the link given at Start or refused; each screen shown, skipped or gone back
from; the video being the wrong one or another of a playlist's chosen; how many topics were
picked and typed; how About you was made (a role, how many goals, their own words), never
what it says; See your overview before the end; the overview failing, and on which screen, and
being tried again; the way to an account; the plan; and the reveal. The run itself is counted
as `capture.newOverview.started` with `from: "onboarding"`.

## Not built yet

- The reveal's next steps under the Verdict (46l) and the first-overview milestone (46m).
- About you in Settings › Personalisation (46s).
- The extension panel's version (46n–46q), which shows the gate until then.
- "Try a sample", "Vote for what's next", the unsorted reveal prompt.
