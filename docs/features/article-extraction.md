# Article extraction

Reading an article out of a web page, the second slice of Trello OV-77. Decided 2026-11-02. What
a reader sees of it is in `article-panel.md`.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Reading a `Document` into an article, or a named failure | `packages/articles/src/readArticle.ts` |
| Structured data and meta tags | `articleMetadata.ts` |
| Sections, with the ids a link can point at | `articleSections.ts` |
| One address for one article | `canonicalArticleUrl.ts` |
| What crosses from the page | `ExtractedArticle`, `ArticleRead` in `packages/domain` |
| The script injected on demand | `apps/extension/src/content/articleReader.ts`, `vite.articleReader.config.ts` |
| Running it in a tab | `apps/extension/src/chromeArticleReader.ts` |
| Asking for a site | `apps/extension/src/chromePageAccess.ts` |

## A package of its own

`@overview/articles` takes a `Document` rather than reaching for `window`, so the server's fetch
for pasted links can run the same code over a page it parsed.

## Getting at the page

The extension's required permissions cover YouTube alone. Making every site required would
disable the extension on update until each reader accepted. So two routes, both optional and
neither prompting on update:

- **Per site, from the panel.** `optional_host_permissions` lists all sites, which is what makes
  it possible to request one. `chromePageAccess.request` asks for that one site, the way
  `chromeProviderPermissions` asks for one provider. It needs a user gesture.
- **`activeTab`, from outside the panel.** Chrome's documented gestures are the toolbar button, a
  context menu, a shortcut and the omnibox. A click inside the side panel is not one of them, and
  the grant ends when the reader leaves the site. The right-click item uses this. Whether the
  toolbar button grants `activeTab` while it opens the panel is undocumented, so nothing relies
  on it.

If per-site prompts prove annoying, the fallback is one optional request for all sites.

`readArticleInTab` doesn't care which route opened the page. Anything that stops the script
running is `no-access`.

## Bundled on its own

Readability would otherwise load with the injected button on every YouTube page. `articleReader.js`
reaches a page only when `executeScript` puts it there, and needs a second call to run, because a
classic script's last value is not a dependable return value.

## Reading

Readability takes the document apart as it reads, so it gets a clone. The reader's page is
untouched, and a test says so.

| Outcome | When |
|---|---|
| `paywalled` | structured data says `isAccessibleForFree: false` and the page shows under 400 words. A reader who can see the whole piece gets it read: that is why this runs in their tab. Carries the words shown |
| `nothing-readable` | under 100 words, or no sign of an article |
| `not-loaded` | the tab is an error page, or nothing readable while it is still loading |
| `no-access` | the script could not run |
| `declined` | the reader said no in Chrome's box, so nothing was read |

**A sign of an article is any one of three:** structured data declaring one, Readability's
`isProbablyReaderable`, or 500 words of prose at no more than 60 words per sentence.

The third exists because `isProbablyReaderable` looks for paragraphs, and refused Paul Graham's
essays, which are table cells and line breaks. Measured on 13 real pages on 2026-11-02, the
essay ran at 20 words per sentence and the Guardian's front page at 163, because headlines
carry no full stops. Share of text in links was tried first and did not separate them: Readability
had already dropped the links, leaving 0.12. Thirteen pages is a small sample, so expect these
numbers to move as real failures arrive.

## Sections

Blocks are walked in order and a heading starts a section, keeping its id or a descendant's as
`anchor`. A heading ahead of any text that repeats the title is the headline and is dropped; the
match is loose because `<title>` usually adds the site's name. If the blocks hold under half the
article's words, a page built out of something else, the whole text becomes one section. Whether
a section can be linked to when it has no id is the note's question (text fragments), not this
one's. Headings Readability keeps vary: of the real articles measured, BBC stories came back as
one section.

## The picture

`imageUrl` is the page's own share image, which publishers set to control how a link looks when
shared: `og:image`, then `twitter:image`, then structured data. Only https, because an https app
can't show anything else. It is a link to the publisher's image, not a copy, so it can move: a
broken one renders nothing, as `OverviewThumbnail` already does for a video, and the card shows its
fallback. Loading it tells the publisher's server that someone opened the library.

## One address

`rel=canonical` wins, including on another site, where a syndicated piece really lives. A canonical
naming the home page is ignored, because that is a template misfiring and would make a site's
articles one item. Tracking parameters and the fragment go. Parameters that choose the page stay, so
the list of tracking names is closed rather than a pattern, `utm_*` aside.

## Not built

- The `web` kind in `Source`, and the id derived from this URL.
- Any button, menu item or failure copy.
- Analytics: extraction failures by reason are counted where a reader can trigger one.
- Removing a site's suffix from a title with no declared site name, as in "A Complete Guide to
  useEffect — overreacted".

## Testing

`readArticle.test.ts` runs handwritten pages in the shape of a news story, a blog, a page built by
script, a paywall shown and unlocked, a shop, a line-broken essay and a front page. They are not
saved real pages, to keep others' text out of the repo. The real pages above were a manual check.
