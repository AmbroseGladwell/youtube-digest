# Pasted article links

Reading an article from a link on the web app: Trello OV-77's fourth slice, designs 77am–77ar.
The extension reads what's on a reader's screen (`article-panel.md`). This is the other route: our
server fetches the page.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| What the server will fetch | `apps/api/src/publicWeb/createPublicWebFetch.ts` and `isPublicAddress.ts`, shared with podcast links; `articles/fetchArticlePage.ts` |
| Turning the page into an article | `fetchedArticle.ts`, the same `readArticle` the extension runs |
| The route | `POST /api/articles/read`, `src/routes/articleRoutes.ts` |
| Reading a link as it's pasted | `useArticleLink.ts` |
| What the field says | `ArticleLinkStatus`, `pastedLinkFailureCopy.ts` |

## What the server will fetch

A pasted link is an address chosen by a stranger, and our server sits on a private network. Without
care, "read this link" would be a way to reach Fly's internal addresses, the metadata service, or
the machine itself. So, in order:

- **An account, or onboarding's trial**, rate limited at 120 an hour per address. Signed out, the
  device's trial token reads a few links of its own, apart from its one overview
  (`docs/features/onboarding.md`, "Any kind of link").
- **http and https on ports 80 and 443**, with no credentials in the address.
- **Public addresses only.** `isPublicAddress` closes loopback, private, link-local, carrier-grade
  NAT, multicast and reserved ranges, in both families, including IPv4 written as mapped IPv6.
- **Checked when connecting, not before.** The rule runs in the connection's own DNS lookup, on the
  addresses it will really use, so a name can't resolve to something public for a check and
  something private for the fetch. Every address a name resolves to must be public.
- **An IP address in the link** is checked directly, since it never reaches a lookup. The URL
  parser turns spellings like `2130706433` into `127.0.0.1` first.
- **Redirects are followed by hand**, at most five, each checked as if it had been pasted.
- **20 seconds and 3 MB**, for the whole fetch.
- **HTML only.** Neither parser below runs script or loads anything the page refers to.
- **Parsed on a worker, with limits**, described under Parsing.

A link refused for any of these reads to the reader as "nothing we can read at that link": we don't
say which address we wouldn't visit.

## Parsing

Parsing takes CPU, and on the server's one thread a big page would stop every other reader's
requests, so it happens on a worker thread.

- **One warm worker, one page at a time.** It is started on the first read and kept, so a read
  doesn't pay to start it. A worker that loaded jsdom for every read (until OV-280) cost about 0.6
  seconds and 120–140MB before reading a word. On the 256MB machine it ran on until OV-279, ordinary
  recipe pages ran out of time and the reader was told the page wasn't an article.
- **parse5, then linkedom.** parse5 is the parser jsdom itself uses, and it lays the page out as a
  browser would: a missing `<head>` or `<body>`, unclosed tags, misplaced table rows. linkedom then
  builds a light DOM for `readArticle`. On its own, linkedom put a minified page's content outside
  its body (danluu.com), and Readability broke on it. With parse5 in front, 24 real pages (BBC
  News, the Guardian, BBC Good Food recipes and front pages, Wikipedia, Paul Graham, Simon Willison,
  danluu.com) read exactly as they did under jsdom: same title, words, sections, recipe, author and
  image. They read 2–4× faster: a recipe in about 60ms rather than 130ms on a laptop.
- **15 seconds and a 160MB heap.** A page that runs past either is `unfinished`, and the worker is
  replaced. 160MB is the smallest limit that reads a page at the fetch's 3 MB cap; 96MB and 128MB
  gave it up.
- **Giving up is ours.** `unfinished` asks the reader to try again. It is never
  `nothing-readable`, which tells them the page isn't an article.
- **Measured under load** (laptop, one worker): 100 of the same BBC Good Food recipe at once all
  read, the last after about 6–7 seconds, peaking at 190MB for the whole process. 100 Wikipedia
  articles, about three times the work, finished in 20–25 seconds at about 225MB. A Fly
  `shared-cpu-1x` machine is slower than a laptop; that is what more machines are for
  (`docs/architecture/deploy.md`, "When it's busy").

## Being an honest visitor

The fetch says what it is in its `User-Agent`, and doesn't pretend to be a browser. A site that
turns that away gets taken at its word, and the reader is sent to the extension, which reads in
their own browser. It doesn't check `robots.txt`: one reader fetching one page they asked for is a
link preview rather than a crawler. It sends no cookies.

Links never appear in logs: what someone reads is theirs. `article read` carries the outcome, the
words and the time. The article's text goes back to the device and isn't kept.

## Read on paste

The design names the article and shows any failure under the field, with Generate gone, so the
link is read as soon as it settles. That read counts nothing against the month, and Generate
spends it rather than fetching again. Held articles are found the same way, by the canonical address
the page gave.

## Differences from the design

- The steps are two, as in the panel (`article-panel.md`).
- 77aq's "That link is a front page" reads "That link isn't an article", and "didn't respond in 20
  seconds" loses the number: the same failure covers a 5xx.
- Regenerating an article away from its page reads it from here too (OV-285, `article-panel.md`,
  "Regenerating"). Its failure is the run's, so it offers only the way that leaves the app.
- **Onboarding takes articles too** (OV-154), through the trial rather than an account.
- There's no way to tell from the web app whether a reader has the extension, so on a computer the
  web app always offers the Web Store. 77an's route appears on the extension's own full page.
