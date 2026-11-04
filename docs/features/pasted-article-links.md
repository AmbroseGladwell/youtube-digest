# Pasted article links

Reading an article from a link on the web app: Trello OV-77's fourth slice, designs 77am–77ar.
The extension reads what's on a reader's screen (`article-panel.md`). This is the other route: our
server fetches the page.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| What the server will fetch | `apps/api/src/articles/fetchArticlePage.ts`, `isPublicAddress.ts` |
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
- **HTML only**, and jsdom's defaults run no script and load no resource.
- **Parsed on a worker thread**, two at a time, for at most 15 seconds. BBC's front page, at 1 MB,
  took 3.7 seconds of CPU on a loaded laptop, and on the server's one thread that would have stopped
  every other reader's requests.

A link refused for any of these reads to the reader as "nothing we can read at that link": we don't
say which address we wouldn't visit.

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
- Regenerating on the web still explains itself, even for an article our server could read again.
- **Onboarding takes articles too** (OV-154), through the trial rather than an account.
- There's no way to tell from the web app whether a reader has the extension, so on a computer the
  web app always offers the Web Store. 77an's route appears on the extension's own full page.
