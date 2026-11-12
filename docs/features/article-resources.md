# Article resources

What an article's note keeps of the places the piece links to. Trello OV-203, decided
12 November 2026. Raised by the owner on a short guide to designing for people with ADHD,
whose note said nothing about the toolkits and guides the piece recommended.

## Why the links never reached the note

Extraction kept each section's text and dropped every link in it, so the model was never
shown them. The prompt couldn't fail to mention resources it never saw.

## The model points, code copies

The same rule as positions (`article-notes.md`) and the lesson of OV-216: the model is never
asked to write an address.

1. **Extraction keeps the links** (`articleLinks.ts`, `articleSections.ts`). Each section
   carries the links its blocks make, in page order, once per article, as `{ text, href }`.
   A link is kept only when it is **https**, is **named in its own words** (not "here",
   "read more", a bare address or a footnote number), doesn't point **back into the same
   page** or to **the site's front page**, and isn't in the page's furniture. Readability has
   already removed most navigation, share bars and footers. Another page on the same site is
   kept, since a guide often links to its siblings.
2. **The prompt numbers them** (`offeredLinks.ts`). After a section's last paragraph come its
   links as `link N: "text" (host)`, so the model can see which part of the piece each belongs
   to. Up to 60 are offered, in page order. Past that a long read's citations are cut rather
   than the prompt grown.
3. **The model names up to five** as `resourceLinks`, the most useful first, and an empty list
   is often the right answer (`articleResourcesSection.ts`). A number outside the list, or one
   named twice, goes back to the model.
4. **Code copies the named links** onto the note's article block as `resources`
   (`assembleArticleOverview.ts`).

**A page with no links is unchanged**: no section in the prompt, no field in the schema, and
the same prompt byte for byte.

## The record

`ArticleDetails.resources` holds one to five `{ text, href }`, both taken from the page.
**Absent rather than empty** when there are none, so an older note, a note without resources
and their share hashes are all unchanged. Overview schema 18 alters nothing and holds these
records back from clients that would drop the field and write the note back without it
(client version 19).

**This is new stored data.** No article text is kept (`article-notes.md`), but these few
addresses and their link text now are, on the note and on a shared copy of it. The privacy
policy's library section says so (`legal-pages.md`, revision log, 12 November 2026).

**A link rots.** The note holds what the page linked to when it was made, as the
quote-based deep links do.

## Where it reaches

- **Assistants** read it in `overviewMarkdown` as "Resources it links to", a list of named
  links, after Read it anyway.
- **Shared links** carry it inside the article block.
- **The screen and narration** don't show it yet. They wait on a Claude Design round:
  where the block sits, how it reads beside Read it anyway's "what this leaves out", and what
  one link looks like against five. Narration should say there are resources, never read an
  address (`spokenScript`).

## Analytics

`newOverview finished` counts an article's offered links and the resources the note names,
as `articleLinks` and `articleResources`. Never an address.

## Not built

- **Video descriptions** routinely carry the links an episode mentions. The shape would be
  the same; it would be its own card.
- **A section switch.** Resources are always asked for when a page has links.
