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
   "read more", a bare address or a footnote number), doesn't open **a picture**, doesn't point
   **back into the same page** or to **the site's front page**, and isn't in the page's furniture. Readability has
   already removed most navigation, share bars and footers. Another page on the same site is
   kept, since a guide often links to its siblings.
2. **The prompt numbers them** (`offeredLinks.ts`). Each link follows **the paragraph it sits
   in**, as `link N: "text" (host)`, so the model reads it beside the words that introduce it.
   Up to 60 are offered, in page order. Past that a long read's citations are cut rather than
   the prompt grown.
3. **The model names up to five, each with why**, the most useful first, and an empty list is
   often the right answer (`articleResourcesSection.ts`). Why is one sentence, a 20-word target
   and a 25-word cap: what the piece says the link is and why a reader would open it, from the
   paragraph around it only. The model hasn't seen the page the link goes to, so it is told never
   to describe it beyond what the piece says. A number outside the list, one named twice, or a
   why over the cap goes back to the model.
4. **Code copies the named links** onto the note's article block as `resources`
   (`assembleArticleOverview.ts`), and **adds where each was shared**: the paragraph's place
   (the same anchor or opening words a chapter links with) and the note's chapter holding it.

**A link without its context isn't much use** (the owner, 12 November 2026). The piece's own
sentence around the link was considered and not chosen. Keeping it would keep article text,
against `article-notes.md`'s decision, and those sentences are often thin ("see X for more", a
bare list item), as OV-216 found of verbatim lifts. Why is written; the place is code's.

**A page with no links is unchanged**: no section in the prompt, no field in the schema, and
the same prompt byte for byte.

## The record

`ArticleDetails.resources` holds one to five `{ text, href, why, place, chapter }`: the link's
text and address from the page, the model's why, and code's place and chapter index, which must
be one of the note's chapters. **Absent rather than empty** when there are none, so an older note,
a note without resources and their share hashes are all unchanged. Overview schema 18 alters
nothing and holds these records back from clients that would drop the field and write the note
back without it (client version 19).

**This is new stored data.** No article text is kept (`article-notes.md`), but these few
addresses, their link text and a line about each now are, on the note and on a shared copy of it. The privacy
policy's library section says so (`legal-pages.md`, revision log, 12 November 2026).

**A link rots.** The note holds what the page linked to when it was made, as the
quote-based deep links do.

## Where it reaches

- **Assistants** read it in `overviewMarkdown` as "Resources it links to": each named link, its
  why, and the chapter it was shared in, linked to that place on the page.
- **Shared links** carry it inside the article block.
- **The note** shows them last, after Read it anyway, closed to start (designs 203a–203w in
  Claude Design, project `668753e1…`, decided with the owner on 12 November 2026;
  `ArticleResources.tsx`). Closed, the heading row ("Resources it points to · 4", or "A resource
  it points to · 1") is one 44px button with a chevron, over a muted line naming the first two
  ("…and 2 more"). Open, each resource is four lines: its site, its name as the link out, why,
  and "From ‹chapter›" opening the article at the place it was shared. With one chapter that line
  is "Where the article shares it". Beside the article in the panel, "From" moves the page there
  instead of opening a tab, as chapter links do. Each note starts closed.
- **Narration doesn't read them.** The block takes no lines in `overviewNoteLines`, so the
  read-along, the scrubber and the spoken script end on Read it anyway, as on a note without
  resources.
- **Read it anyway** no longer names the further reading in "It leaves out…" when the page has
  links, since the block carries it (`readAnywaySection.ts`).
- **The shared page** shows the same block, and "From" opens the article itself.
- **Settings › Personalisation** has a switch, last in the list. Off hides the block on every
  overview. Unlike the other switches, resources are still made and kept while it's off, because
  no article text is kept to make them from later; the note under the switch says so.

## Analytics

`newOverview finished` counts an article's offered links and the resources the note names,
as `articleLinks` and `articleResources`. Never an address.

## Not built

- **Video descriptions** routinely carry the links an episode mentions. The shape would be
  the same; it would be its own card.
- **Opening by itself** when a link points into the block: nothing links into a note's
  sections yet.
