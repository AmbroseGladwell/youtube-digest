# Where Plus is sold

**What Plus sells changed in OV-78, and the copy caught up in OV-104.**
`v1-architecture-decisions.md` originally decided a paid tier was for infrastructure that
inherently needs a server, and named cross-device sync and TTS. `docs/architecture/tiers.md`
replaced that: **the paid plans sell volume, never features.** Sync, narration with every
voice and the MCP connection all belong to the free account, because they are what makes
signing up worth doing. What a reader runs out of is overviews.

So there are two paid plans, and both are a number of overviews a month:

| | Overviews on our key | Overviews on your own key |
|---|---|---|
| Free account | 10 a month | 30 a month |
| BYO Plus | 10 a month | 200 a month |
| Plus | as many as about $2.50 of cost buys (OV-92 sets it) | 200 a month |

**No plan ever says "unlimited"**, and every number is shown with its reset date. Plus's
own-key number is the one figure the app cannot print yet, because OV-92 has not measured
what an overview costs; the panel says "more a month on our key" until it has.

`PLAN_CARDS` and `EVERY_ACCOUNT_INCLUDES` in `planCards.ts` are that table, written once,
and the panel and the IWFT scenarios both read them. Plus's figure on our key is `null`
there rather than a guess, and renders as "More a month" until OV-92 fills it in.

Design turn 16 asked where a free user should be told any of this. It offers three places
and says they are not exclusive — 16c should exist regardless, and one of 16a/16b is the
active prompt. The panel is small enough that they never appear at once.

## The plan is the account's, and nothing is gated on it

`Settings` grew `plan: "free" | "plus"` long before accounts existed, and `Settings.plan` is
no longer read: a plan is a fact about an account, and a locally-writable one would be a lie
whichever way it was written.

The server's `accounts.plan` is the real one, set by hand until OV-18 bills for it. The
clients read it from `GET /api/session` through `usePlan()`, and a device with no session is
on Free. Until a signed-in device has the answer its plan is unknown, and the panel says so
rather than guessing Free.

**Nothing is gated on it today.** The MCP connector used to be, and OV-104 took that gate
out (`mcp-connector.md`). What the plan will gate is how many overviews a month the account
can make, which OV-102 and OV-103 count.

Two consequences worth being explicit about:

- **Read through `usePlan()`, never off `Settings` directly.** A settings record written
  before the field existed has no such key at all — the unvalidated-read trap
  `v1-architecture-decisions.md` describes — so the fallback to `"free"` lives in one
  place.
- **Settings has no `Upgrade to Plus` button.** 16c draws one. A control that cannot work
  is precisely what `CLAUDE.md`'s degrade-visibly rule forbids, and there is no checkout
  behind this one. So the Plus card lists what Plus adds and then says plainly that it
  needs an account and a way to pay, neither of which is built, and that everything on
  the page works without one. When there is something to buy, that paragraph becomes the
  button and nothing else about the three placements changes.

## 16a — on Listen

*Retired by OV-40: audio needs an account rather than a plan, so the panel's Listen now
plays (`audio-player.md`, "What changed about Plus"). What follows is kept as the record of
why it existed.*

The moment of want. In the panel, pressing `Listen` on a free plan opens a prompt docked
under the same 2px rule the masthead uses: *Listening is part of Plus. It also syncs
every overview to the web app and your other devices.* `See what Plus adds` goes to
Settings; `Not now` puts it away for the session.

**It does not play.** That is the design's call and it has a cost worth naming: today
`Listen` reaches the read-along, which has no audio behind it and works perfectly well
for free on the web reader (`docs/features/overview-redesign.md`, "The player bar without
audio"). So a free user gets the reading mark on the web and a sales pitch in the panel,
for the same underlying feature.

That inconsistency is real and it is deliberate. `Listen` in the panel is the audio
control the design draws it as, and the read-along is standing in for audio that does not
exist yet; the wide reader's bar is a different thing — always present, never sold,
because every control on it does something. When TTS lands, the panel's `Listen` starts
meaning what it says and the oddity goes away on its own. If that wait turns out to be
long, the cheaper fix is to sell audio only and leave the reading mark free everywhere,
which is one condition in `ReaderPage`.

The prompt takes the foot of the window rather than the end of the note, on the same
sticky hold the player bar uses. A case for Plus that has to be scrolled to is a case
nobody reads, and the press that summons it is at the top of the panel — so it arrives
where the eye already is.

Docking is its own state rather than a read of whether the reading mark is moving.
Pausing from the bar is the only way a Plus listener can pause, so a bar that vanished on
pause would take away the control that had just been used; `Listening` is what puts it
away again.

## 16b — after a capture

The moment of loss, and the only one of the three that arrives unasked. An overview the
panel has *just written* carries a hairline note above the tabs: **Saved on this browser
only.** A free account syncs your overviews to the web app and your other devices, and
reads them aloud.

**It sells an account, not a plan, and so it is shown only to a reader who has none**
(OV-104). It used to be shown to anyone not on Plus, which told a signed-in free reader
their overview was local when the server had been syncing it since sync was built. A device
that has not heard back from the server is not told its overview is local either. The
component is `SavedLocallyNote`; the dismissal is still stored as `plusNoticeDismissed`, so
a reader who has already put it away does not meet it again.

The note a signed-in reader should get at this moment is their remaining count for the
month, which waits for OV-102 and OV-103 to count overviews.

"Just written" is carried as router state on the navigation the capture page makes, not
as a flag on the run — the run is dismissed by the time the reader is on screen. Opening
the same overview again later shows nothing, which is the point: it is a note about what
just happened, not a banner about the plan.

Dismissing it is permanent, stored as `plusNoticeDismissed`. An unasked-for prompt that
comes back is worse than one that never appeared.

It is quieter than 16a by design — a hairline box with one accent edge, against 16a's
docked panel on an accent wash. 16a was asked for by pressing something; this one
interrupted.

## 16c — in Settings, redrawn by 95d–95h

The permanent home, above the keys: the plan's name, what every account includes, and then
**all three plans as cards** — Free, BYO Plus, Plus — each carrying both quotas as a two-cell
`dl`, "On us" and "On your own key". The reader's own card is tinted and ringed
(`inset 0 0 0 1.5px var(--label)`, the same device the old Connections offer used) and
carries a "Your plan" pill, so which plan is theirs reads before any copy does.

Free is a card rather than a sentence. 16c used to put its allowance in prose above the
offer, which 95g drops: the cards carry it, and on a paid plan a line about Free was beside
the point.

This is the one the other two point at, which is what lets 16a and 16b stay short: they
name the thing being sold and hand off, rather than each carrying a full case.

**What 95d–95h draw that is not built:** the usage block above the cards — the plan's name
beside "This month · resets 1 November", and the two quota cells reading "7 of 10 left" —
and the Settings list row's "Free · 7 of 10 left". Both are counts, and nothing counts yet
(see "Not built", below).

## Not built

- **Anything that takes money.** No checkout, no trial, no account. 16a's
  `Try Plus free for 7 days` is a promise nothing can keep, so it is
  `See what Plus adds` instead.
- **Gating sync, narration or the MCP connection.** None of them is Plus's to gate: they
  belong to the free account (`tiers.md`). The server has given sync to every account since
  it was built, and the copy that said otherwise was the thing that was wrong.
- **Showing what is left this month.** The counts are the server's, and nothing counts
  overviews yet: OV-102 for an account's two quotas, OV-103 for the signed-out trial. Until
  they land the panel states each plan's allowance and no reader is told their own usage.
- **Selling anything on the web app.** The three placements are the panel's, which is
  where the design puts them. The web reader is untouched.
