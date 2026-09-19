# Where Plus is sold

`docs/architecture/v1-architecture-decisions.md` decided what a paid tier is for:
infrastructure that inherently needs a server. Cross-device sync and TTS are on that
list; BYO-key generation is not, at any tier. Design turn 16 takes those two and asks
where a free user should be told about them. It offers three places and says they are
not exclusive — 16c should exist regardless, and one of 16a/16b is the active prompt.

All three are built, because all three answer a different question, and the panel is
small enough that they never appear at once.

## The plan is a local placeholder, and says so

`Settings` grew `plan: "free" | "plus"`, defaulting to free. Nothing sets it to `plus`
except a test. That is not an oversight being papered over: a plan is a fact about an
account, accounts do not exist yet, and a locally-writable plan would be a lie whichever
way it was written.

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

Docking is its own state rather than a read of whether the reading mark is moving.
Pausing from the bar is the only way a Plus listener can pause, so a bar that vanished on
pause would take away the control that had just been used; `Listening` is what puts it
away again.

## 16b — after a capture

The moment of loss, and the only one of the three that arrives unasked. An overview the
panel has *just written* carries a hairline note above the tabs: **Saved on this browser
only.** Plus syncs your overviews to the web app and your other devices, and unlocks
audio overviews.

"Just written" is carried as router state on the navigation the capture page makes, not
as a flag on the run — the run is dismissed by the time the reader is on screen. Opening
the same overview again later shows nothing, which is the point: it is a note about what
just happened, not a banner about the plan.

Dismissing it is permanent, stored as `plusNoticeDismissed`. An unasked-for prompt that
comes back is worse than one that never appeared.

It is quieter than 16a by design — a hairline box with one accent edge, against 16a's
docked panel on an accent wash. 16a was asked for by pressing something; this one
interrupted.

## 16c — in Settings

The permanent home, above the keys: the plan's name, and what Plus adds. On Plus it reads
as a statement of what is included rather than a pitch, with no offer box at all.

This is the one the other two point at, which is what lets 16a and 16b stay short: they
name the thing being sold and hand off, rather than each carrying a full case.

## Not built

- **Anything that takes money.** No checkout, no trial, no account. 16a's
  `Try Plus free for 7 days` is a promise nothing can keep, so it is
  `See what Plus adds` instead.
- **Gating sync.** There is no sync to gate — both libraries are local and the extension
  and web app cannot see each other's (`v1-architecture-decisions.md`, "Two local
  libraries is the free tier's honest shape"). The prompts describe what Plus would add,
  and nothing is being withheld from a free user that currently exists.
- **Selling anything on the web app.** The three placements are the panel's, which is
  where the design puts them. The web reader is untouched.
