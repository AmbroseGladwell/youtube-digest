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
