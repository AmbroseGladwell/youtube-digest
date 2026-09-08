# Constraints hit, and what they cost

Two kinds of thing here. The first section is environment-specific and mostly disappears in a real build, but is recorded so nobody rediscovers it. The second section is not environment-specific at all and should be carried forward.

## Lessons that outlive the prototype

### Never let a model count, measure or time anything

The worst bug of the project. Asked to report transcript word counts so a video runtime could be estimated, a fetch returned fabricated numbers. It was only caught because all five results ended in the same three digits and one figure repeated across unrelated videos. A wrong figure had already been quoted to the user before the check.

The rule that came out of it: any number that will be shown to a user must be produced by code operating on data, never reported by a model reading a page. If code cannot produce it, do not show it.

A related judgment: when a figure is genuinely an estimate, present it as one. A word-count-derived runtime carries roughly ±25% error because speaking rates vary from about 120 to 180 words per minute, so "~13 min video" is honest and "~12:48" is a lie about precision.

### Transcript retrieval is the fragile link

It fails intermittently on videos that definitely have captions. A single retry recovers most failures. Anything downstream must tolerate a video failing today and succeeding tomorrow, which means failures must not mark the item processed.

Also: the transcript source used by the prototype exposes no duration field, and its timestamps are rendered by client-side JavaScript, so they are invisible to anything that does not run a browser. If you find a source that exposes timings server-side, video runtime becomes exact and free, and a feature that was abandoned becomes trivial. That is worth ten minutes of looking.

### Parsing your own generated format needs to be defensive

Two real failures in the samples:

- A note whose Verdict section begins "Novel in construction, oversold in framing" has the leading word stripped as if it were the label, leaving the reasoning starting mid-sentence. The parser cannot distinguish a label from a sentence that opens with the same word. A real build should not re-parse prose it generated; it should keep the fields structured from the start.
- Actions arrive numbered in some notes and dash-prefixed in others, from the same template. Handle both, or constrain the generation.

### Coverage limits

Captions only. No captions, no note. Audio transcription would widen coverage considerably and is the obvious next capability. YouTube first; Instagram, TikTok and Facebook are where much of this content lives and are harder to reach.

## Environment specifics, recorded so they are not rediscovered

These are Cowork and Claude artifact limits. A conventional web app has none of them.

**Published artifact pages** run under a content security policy that blocks `fetch`, XHR and WebSocket to every host except a short script CDN allowlist, including a library's own runtime downloads. This is why an in-browser TTS model is impossible there, and why any media has to be embedded or served from the artifact's own storage. Pages also cannot start their own downloads; a file has to be handed over through a platform capability that prompts the viewer.

**The artifact document store** caps documents at 256 KiB and 5000 per artifact, which is why anything large has to be split into parts and reassembled client-side. The file-attachment capability was not available on this account, which forced that workaround.

**Declaring a database on an artifact makes it organisation-internal**, so it cannot be shared publicly. The live library therefore cannot be sent to anyone for feedback. The workaround is a separate copy with the database dropped, or the per-note PDF export.

**Google Drive, via the connector**, cannot edit file contents in place. Updating a file means creating a new one with the same name in the same folder and then trashing the old one, in that order, so a failure leaves a harmless duplicate rather than destroying the file. Reads must use the download-and-decode path, because the plain read escapes markdown characters.

**Gmail matches labels at thread level**, so a `-label:` exclusion in a search does not reliably filter processed items. Every result has to have its own label list checked. Getting this wrong creates duplicate notes, which was the worst failure mode available to the pipeline.

**The build container's egress is allowlisted.** PyPI, npm and GitHub release downloads work. HuggingFace, cdnjs and most API hosts are blocked. This is why the speech model is fetched from a GitHub release rather than HuggingFace, and why a JavaScript library that would normally be loaded from a CDN was inlined at build time instead: the CDN could not be verified from the build environment, and a silently broken feature is worse than a heavier page.
