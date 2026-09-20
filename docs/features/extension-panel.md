# The side panel is one video, not a library

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

**Opening (15a).** The masthead is the mark and `Settings` — no `+ New`, no nav. Below
it, the offer: the headline, the standfirst, and one action. `Create overview` is live
when there is a video in front of the panel and both keys are set; it is disabled with
the reason underneath when there is not. A dead control normally violates `CLAUDE.md`'s
degrade-visibly rule, and this one is the exception the rule allows: the button is the
page's only subject, so removing it would leave a page about nothing, and the line under
it says exactly what is missing. Where the missing thing is the keys, the panel says so
and links to Settings, the same way the empty library hero does.

**Working (15b).** The whole page becomes the run. It is the same numbered progress list
the dialog shows, because it is literally the same component: `GenerationSteps` was
pulled out of `NewOverviewDialog` so a run reports the same two steps, the same receipts
and the same states wherever it is watched. What the panel adds is the warning the
dialog's foot already carried on this surface — closing the panel stops the run — now
stated as the page's own last line rather than as a caveat on a background option that
does not exist here.

**Ready (15c/15d).** The finished run navigates to the reader, and the panel's reader is
the wide one with everything it has nothing to point at removed: no breadcrumb, no
`↑ Previous` / `Next ↓`, no thumbnail, no rail. What is left is title, channel, topics,
the meta line, `Listen`, `⋯`, the three tabs and the tags at the foot.

**And in the panel that head holds still.** The wide reader sticks its app bar and its
tab strip and lets the note's own masthead scroll away, which is right there — it
carries a thumbnail, a trail and a stepper, and holding it would cost the note most of
the window. Pared back to 15c it is four short lines, and at 400px the question of which
video you are reading is worth never having to scroll back for. So in the panel the
stack is the app's bar, the note's head, the tabs, and — on the Transcript tab — its
tools, which keeps search, copy and export reachable part-way down a long transcript.

None of that is a second set of offsets. `--reader-masthead-height` is `0px` in the
tokens and published only by a layout that sticks the masthead, so the one formula each
of the tab strip and the transcript's tools already had gains a term that is zero
everywhere else. `readAlong.iwft.ts` is what holds the wide reader to the old
arrangement, and would fail if this leaked into it.

Chapters is the one tab where none of this can be observed: it is still a placeholder
with nothing to scroll. The masthead and the tabs render outside the tab panel, so it is
the same chrome by construction rather than by assertion — `panelChrome.iwft.ts` covers
the mechanism on the two tabs that can actually move.

There is no fourth screen, and in particular there is no list. The way back out of the
reader is the mark in the masthead, which is a link home in every layout already.

The panel is not the only way in. The button injected into YouTube's action row opens it
already running, which is design 17d — `docs/features/injected-button.md`.

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

## Where this departs from the file

- **The panel's head prints two facts, where the wide reader prints five.** 15c draws
  the title and the channel; the wide reader's byline runs channel, published, saved and
  novelty across one line, which at 400px wraps into a paragraph about when things
  happened. Published, saved and novelty are dropped there and the channel moves under
  the title, above the topics and the read times. The warnings — thin, and a dubious
  claim — stay: those are the note's judgement rather than its filing.
- **The ⋯ menu hangs from the trigger's leading edge in the panel** and its trailing edge
  on the wide reader, because the trigger sits at opposite ends of the two. A menu fixed
  to one edge leaves the window on the other layout. Sticking the panel's head also gave
  it a stacking context, which the menu cannot escape however high its own z-index goes,
  so the head outranks the tab strip rather than the menu trying to.
- **`Mark read` is gone from the panel's reader.** 15c draws `Listen` and `⋯` and nothing
  else, and read state is a property of a list the panel does not have. It is still
  there on every other surface, and still settable from a library row.
- **The keys block shows only when a key is missing.** 15a draws it on both of its
  screens, but both of those are first-run states; once the keys are in, the block is a
  paragraph about a solved problem. This follows the empty-library hero, which already
  made that call.
- **The masthead's wordmark is "The Overview", not "Overview".** The design's panel
  shortens it; the app has one wordmark and shortening it only in the panel would read as
  two products.
- **Settings' back link reads `← Back` in the panel**, where it reads `← All overviews`
  everywhere else. There are no overviews to go back to — there is the one video.
