# The side panel is one video, not a library

The panel now takes articles too, and has a home for pages that are neither
(`article-panel.md`). A disabled Create with its reason under it, described below, stays for
missing keys; on a page with nothing to take there is no button at all.

The extension shipped as the web app in a 400px column: the same masthead with `+ New`
and a two-item nav, the same library, the same reader with a rail beside it. Design turn
15 argues that is the wrong shape for the surface — "the extension exists to capture the
video you are on" — and this is that argument built.

## A layout the shell asks for, alongside the surface it already declared

`App` already took `surface` because `app-core` cannot read `chrome.*` to work out which
shell it is in (`src/app/SurfaceContext.ts`). It now also takes `layout`:

```ts
type AppLayout = "full" | "panel";
```

Two props rather than a third value on `Surface`, because they answer different
questions and the extension answers them differently in its two documents:

| Document | `surface` | `layout` |
|---|---|---|
| `apps/web` | `web` | `full` |
| `apps/extension/app.html` (options page) | `extension` | `full` |
| `apps/extension/sidepanel.html` | `extension` | `panel` |

`surface` is *which library am I* — both extension documents share one IndexedDB and both
have to say so. `layout` is *am I the column beside a video or the whole app*. Collapsing
them into one enum would have made every existing `surface === "extension"` check wrong,
and there are two of them saying exactly the thing that is still true in both documents.

The tempting alternative was to derive it: the panel is the shell that injected an
`ActiveVideoSource`, so `useActiveVideoUrl`'s own context could have carried it. That is
true today and was rejected anyway — `activeVideo.iwft.ts` drives the *full* layout with
a simulated source precisely to test the dialog's prefill, and folding the two together
would have made that scenario untestable. A capability and a layout are not the same
claim even when the same shell happens to supply both.

## Three screens, and no fourth

Signed in, that is. Signed out, the panel's home is onboarding's Start, or on a device that
has had an account the way back into it (`onboarding.md`, "In the extension panel").

**Opening (15a, then 205a and 205f).** The masthead is the brand slot, `+ New` and the
account menu — the phone's bar, and still no nav. Below it, what the tab holds: one offer
card giving "Source · Kind" and the title for a video and a page alike, then `Create
overview` and what is left this month. No headline and no standfirst while there is
something to take; with nothing on the tab they come back, with Recent under them.

`Create overview` is live when there is something in front of the panel and an overview
can be made of it — which needs either a key of the reader's or a server to make it on,
so a reader with no key of their own is ready anyway. It is disabled where neither is
there, which in practice is an unpacked build. Nothing says why any more: 205f-3 took the
keys note out, having judged the state unreachable in a build with a server, and the
at-limit message is the panel's only route to API keys now.

**Working (15b).** The whole page becomes the run. It is the same numbered progress list
the dialog shows, because it is literally the same component: `GenerationSteps` was
pulled out of `NewOverviewDialog` so a run reports the same two steps, the same receipts
and the same states wherever it is watched. What the panel adds is the warning the
dialog's foot already carried on this surface — closing the panel stops the run — now
stated as the page's own last line rather than as a caveat on a background option that
does not exist here.

**Ready (15c/15d, then 205b).** The finished run navigates to the reader, and the panel's
reader is **the phone's**. OV-205 settled that: at 400px the panel is a phone-width column,
and giving it an arrangement of its own only meant two readers to keep in step. So it is
the phone's head — the way back and `⋯` on one row, then the note's own thumbnail beside
the channel and the verdict, the title, the topics, the meta line with its dates, then
`Listen` full width with `Favourite` beside it — and the phone's foot, where `Mark read`
sits with `Favourite` and the "Saved you N min" pill comes in. What the panel still drops
is what it has nothing to point at: no `↑ Previous` / `Next ↓`, no rail.

**And that head scrolls away.** It used to stick, on the argument that at 400px the
question of which video you are reading was worth never scrolling back for. 205b reverses
it: the head is now the phone's full head rather than four short lines, and holding it
would cost the note most of the window — the measured stack at 400 × 720 leaves 346px for
the note with the head held against the bar, against 508px without it. So the panel's
sticky stack is the app's bar, the tabs, and — on the Transcript tab — its tools.

With nothing left sticking a masthead, `--reader-masthead-height` had no publisher and was
removed along with the term it contributed to the tab strip's and the transcript's tools'
offsets. `readAlong.iwft.ts` still holds the wide reader to its own arrangement.

Chapters is the one tab where little of this can be observed: a chapter list is short
enough to fit, and it does not scroll to follow the video by design
(`docs/features/chapters.md`). The masthead and the tabs render outside the tab panel, so
it is the same chrome by construction rather than by assertion — `panelChrome.iwft.ts`
covers the mechanism on the two tabs that can actually move.

There is no fourth screen, and in particular there is no list. The way back out of the
reader is the one every other place has: see "One slot, one way out" below.

The panel is not the only way in. The button injected into YouTube's action row opens it
already running, which is design 17d — `docs/features/injected-button.md`.

## One slot, one way out

OV-205, designs 205a–205h and 205w. The panel's places are home — the tab in front of it —
and everywhere a reader can go from there: a note, settings, a section of settings. The
queue is not in the extension, and the policy pages open in the web app rather than here
(`PolicyLinks` and `AccountTermsLine` build their address from `useKnownApiUrl`, which is
the server this build was made for whether or not anyone is signed in), so neither is a
panel place and neither lends a link. Before this, only settings and a section said how to
leave, each in its own words, and the note said nothing at all: the mark in the bar went
home but nothing told anyone so.

**The way back is named after home, and home is the tab.** `useHomeName` answers
`This video`, `This page` or `Home` from `useActiveVideoUrl` and `useActivePage`, reusing
the same `isOfferedPage` rule the capture page draws its own offer from. It follows what the
tab holds **now**, not what it held when the reader left home, so a reader who has moved the
browser on is told by the label itself. A section of settings keeps its own destination,
`Settings`, being two steps deep.

**It lives in the bar's brand slot, exactly as on a phone** (`back-within-reach.md`). The
only reason the panel was excluded was the width query, and `handoffLive` now reads
`headBackLink !== null && (isPanel || headScrollsAway)`. The hand-off's own stylesheet moved
out of `@media (max-width: 61.9375rem)` and is keyed off `.brandSlotLive` instead, which is
the same condition stated once by the component that already decides it — and which is what
makes 205w work, a panel dragged wider staying a panel.

**A page that has no head to scroll away lends its link without drawing one.**
`HeadBackLink.element` is nullable and `useLentBackLink` takes `inPage`, so settings and its
sections lend to the bar and draw nothing of their own in the panel; `useBackInBar` reads a
null element as "the slot has it from the first frame". The note keeps its own link and
hands over on scroll, as the phone does.

**`+ New` joins the panel's bar** (205c-2). Pasting a link no longer means going home first.
The dialog is mounted in the panel only while it is open, because left mounted it would put
a second copy of a run's progress in the document — the panel's own page is where a run is
watched. Starting one from the dialog closes it and returns the panel to home, which is
where creating from the offer would have left it anyway.

**The wordmark is "The Overview" in the panel too.** The stone reskin had shortened it to
"Overview" while this doc recorded the opposite as a deliberate departure; 205c settled it
the doc's way and the code now matches. Only its size is the panel's.

## The line under the bar

Design 205e. With a note open and the tab moved on to something else the panel could take,
one 36px line sits in the measured band under the bar, where the web's status strip sits and
where nothing else renders in the panel.

It shows **on a note only**: settings and the queue are not about a video, so there is
nothing for the tab to have moved away from, and home is already the offer. What counts as
"moved on" is matched on the video's own id rather than the URL, the same rule "Already in
the library" above gives.

Its copy is generic — "Another video on this tab", "Another page on this tab" — and never
names what is there. The reader can see the tab beside the panel, so naming it would only
cost the line its one line, and at 400px there is one line. The offer is `Read overview`
where the library already holds it and `Make an overview` where it does not; making starts
the run and lands on home, which is the run's own page in the panel.

`×` hides it until the tab moves again, not for the session: a dismissal is about this
video, so moving on asks afresh. It survives a trip to settings and back, the tab not
having moved. With `StaleClientBanner` showing, both stack and the reload notice comes
first, since that one is about the app itself.

`capture.onThisTab` counts it: `shown`, `followed` and `dismissed`, each with
`offer: make | read`. No title, address or channel, in line with every other capture event.

## The run still belongs to the shell

`useNewOverviewRun` did not move. The `AppShell` is still the one component that survives
every navigation, and it still owns the run — `NewOverviewRunContext` only hands it down,
so the panel's own page can render the progress the shell is tracking. That keeps one
answer to "is a generation going" across both layouts rather than two implementations
that could disagree about whether cancelling worked.

What the panel does not render is the dialog and the status strip. Both exist to let a
run outlive the surface it was started from; in a side panel it cannot, so neither has a
job.

## Already in the library

The design's opening screen offers to write an overview and says nothing about the case
where one already exists. Left alone, that makes the panel a machine for buying the same
video twice: the reference extension's own scar
(`docs/features/watching-detection.md`) is exactly this. So when the video in front of
the panel is already in the library, the primary action reads `Read overview` and
`Write a new one` sits beside it as quiet type.

Matched on the video's own id rather than on the URL, because `youtu.be/X` and
`watch?v=X&t=30` are the same video — the same reasoning
`docs/features/transcript-storage.md` gives for keying captions that way.

## Open in web app

Design 6h puts `Open in web app` in the panel's ⋯ menu where the wide reader has read
state and deletion. The note's address in the web app is `/overviews/<id>` on the server
this device syncs with, because that one origin serves the API and the web app
(`docs/architecture/deploy.md`). But the address exists only once the note does, so the
item asks sync before it offers the link: a note the server holds a revision of, whether
pushed from here or pulled from another device (`SyncStorage.revisionOf`), opens in a new
tab. A note written in the panel and not yet pushed would open on "That overview isn't in
your library".

So there are three answers, one per reason the page might not be there, and each says it
under the label. A disabled item cannot be focused, so a `title` would reach nobody using
a keyboard:

- **Synced.** A link to the note in the web app.
- **Signed in, not yet synced.** Disabled: "Not in the web app until it syncs". The check
  sits under the overview query keys, so the pull that follows a push, which carries this
  device's own write back, re-asks it and the item enables without reopening the note.
- **Signed out.** Disabled: "Sign in to see it in the web app". A free library in the
  extension is its own, and signing in is what joins it to the web app. Sharing makes
  the same call: the control shows and says what it needs.

A shell that cannot sync at all has no web app to open, so the item is not there.
`openInWebApp.iwft.ts` covers all four.

## Where this departs from the file

- **The panel's head keeps the judgement, and now the dates with it.** It used to drop
  published and saved, on the argument that at 400px they were a paragraph about when
  things happened wrapped around the two words that say what the note is. 205b gives the
  panel the phone's head outright, dates included, rather than keep a third arrangement in
  step. The verdict and the warnings still share the channel's line, and the fixture the
  panel's tests seed carries every one of these so what is kept is asserted rather than
  passing on an empty note. That they share a line is measured as overlapping rows rather
  than a shared top edge: a topic chip has a border and padding that plain text beside it
  does not.
- **The ⋯ menu ends the panel's action row**, after `Listen` and `Mark read`, and hangs
  from its trailing edge as it does on the wide reader. 15c puts it straight after
  `Listen`, hanging from its leading edge; with `Mark read` between them a menu hung that
  way would leave the window. Sticking the panel's head also gave it a stacking context,
  which the menu cannot escape however high its own z-index goes, so the head outranks
  the tab strip rather than the menu trying to.
- **The panel's ⋯ ends with `Delete overview`, after `Open in web app`.** 205b-2 draws the
  panel's menu in the phone's order, ending in Delete, and does not draw 6h's `Open in web
  app` at all. Both are kept: 6h's reasoning — the panel is the one surface where the web
  app is somewhere else — is untouched by OV-205, and the panel had no way to delete a note
  before this. Delete is last either way, as the design has it.

- **`Mark read` left the panel's head again.** 34v had put it beside `Listen`, because
  reading the note in front of the video is the one time saved the panel can see. 205b
  moves it where the phone keeps it: in the `⋯` menu, and with `Favourite` at the note's
  end, which is where the "Saved you N min" pill comes in. `Listen` keeps the row, now with
  `Favourite` beside it, and keeps its panel job of docking the player at the foot of the
  window rather than reading the note where it stands.
- **The keys block has gone from home entirely.** It used to show when a key was missing.
  205f-3 removes it: `GenerationReadiness.ourKeyUsable` needs only a server that makes
  overviews, so in any build with one a reader without a key of their own is ready anyway
  and the block was a paragraph about a problem they do not have. `Create overview` is
  still disabled where nothing can make one — a shell with no server and no key, which is
  an unpacked build — and the at-limit message is now the only route to API keys from the
  panel.
- **The design names `--motion-state` for the hand-off's "about 320ms".** The token is
  120ms. OV-167 already made that call for the phone and the panel reuses its stylesheet,
  so the base duration is `--motion-arrive` (300ms), unchanged.
- **Settings draws no back link at all in the panel.** It used to read `← Back` there,
  against `← All overviews` everywhere else. 205d-2 has it lend to the bar instead, named
  after the tab, so the panel has one way out rather than one per page.

## What the panel cannot have

**Chrome does not autofill in it.** The sign-in form's email field is marked the way a
browser wants one: a real `<form>`, a `<label>`, `name="email"`, `type="email"`,
`autoComplete="email"` and `inputMode`. Chrome still offers nothing, because its autofill
does not run on `chrome-extension://` documents. Nothing in the markup changes that, so the
markup is correct and the behaviour is the platform's. A password manager with its own
extension may fill it; Chrome's own will not. Checked 6 November 2026, against a store
build of 0.4.0.

**The server field is only in an unpacked build.** "Use a different server" is how a build
loaded unpacked talks to `http://localhost:3000` (`docs/architecture/deploy.md`, "The
extension"). Installed from the Web Store there is no other server to name, and the question
is noise on a sign-in page, so `mountApp` passes `serverSwitchable` from whether Chrome put
an `update_url` in the manifest it hands back: present for a store install, absent for an
unpacked one. It is the only signal for this that costs no permission, and a permission
added for a cosmetic question is one more to justify at review.
