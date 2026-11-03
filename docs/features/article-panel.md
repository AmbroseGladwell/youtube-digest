# Making an overview of an article from the panel

The panel half of Trello OV-77: designs 77aa–77al, 77r, 77x, 77y, 77ar–77au, 77ax, 77ay. Pasted
links on the web are a separate slice.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The tab, as app-core sees it | `ArticlePages` in `app/ArticlePagesContext.ts`; `apps/extension/src/chromeArticlePages.ts` |
| A run of an article | `runArticleOverviewGeneration`, `useNewOverviewRun.startArticle` |
| An article on either key | `generateOverviewOf`; `OurKeyGenerationRequest` takes an `article` |
| The panel's screens | `CapturePage`, `ArticleOffer`, `ArticleFailureNotice`, `RecentOverviews` |
| Every failure's words | `articleFailureCopy.ts` |
| Right-click | `serviceWorker.ts`, `useArticleMenuRequest.ts` |
| Links that move the page | `showArticlePlace` in `packages/articles`, `useShowOnPage.ts` |

## Nothing is read before Create

The first-time line promises "We only read a page when you press Create", so it holds everywhere.
Before Create the panel knows what the tab says: its address and title. That is why the card has
no word count until the run has read the page, where designs 77ab and 77ad draw one, and the title
can still carry the site's suffix. Reading an allowed site on arrival would give the design its
count and break the sentence under it, on every page the reader visits with the panel open.

For the same reason the panel can't tell an article from anything else in advance. A site's front
page, by its address, gets the home screen. Anything else is offered, and reading it is what
finds out (77ak).

## Asking Chrome

`requestAccess` has to run inside the click, so `useStartArticleRun` calls it before anything is
awaited and hands the run the promise. On a site already allowed it resolves without a box.
"Ask Chrome again" is a press for the same reason. The reload path can't ask, and doesn't need
to: the read it follows got in.

Nothing is reserved until the page has been read, so "Nothing counted" is true of every failure.

## Right-click

The menu's click grants `activeTab` and is what lets the panel open, so the worker opens the panel
before its first await, as the injected button's message does. The page goes through session
storage because the panel may not exist yet. On a watch page it becomes a video request, which needs
no access. The grant lasts until the reader leaves the site, so a note made this way says Create may
still ask.

## Duplicates

Checked twice. Before Create, by the tab's address with tracking removed, which offers Read
overview. After reading, by the canonical address on the page, which catches a newsletter link to
something already held, and opens it with a line saying when it was made. The second check can only
run after reading, which is why it lives in the pipeline.

## Beside the article

`useShowOnPage` is null unless the tab in front is this article, which is what keeps every link an
ordinary link elsewhere. Beside it they are buttons that scroll the page. Finding a place tries the
heading's id, then the opening words across the page's text, since a quote can cross inline
elements. Three answers: moved, gone (said in the row, 77y), or couldn't look, which falls back to
opening the place's address.

## Regenerating

Articles only: there is no ⋯ Regenerate for videos. It writes under the same id, so the old note
stays until the new one lands. Away from the article the item ends in an ellipsis and explains, since
we keep no copy.

## Differences from the design

- Two steps, not three. "Recording the narration" isn't a step a run waits on, and the existing test
  says so; 77ae's progress bar goes with it, each step keeping its own.
- 77ae's "You can leave this page" isn't said. Closing the panel stops the run, so the existing
  line stays.
- 77ak names no front page: reading can't tell one from anything else unreadable.
- 77aa shows three recent overviews.

## Testing

`articlePanel.iwft.ts` runs each route against `IwftArticlePages`, the seam for a tab.
`showArticlePlace.test.ts` covers finding a place. `generationRoutes.test.ts` makes one on our key.
Chrome's box and its gestures can't be driven by a test, so they need checking by hand.
