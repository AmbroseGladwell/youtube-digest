# Decisions, and what caused them

Everything here came out of using the prototype daily rather than designing it up front. Where a decision was forced by a bug or a failure, the cause is named, because the reasoning matters more than the rule.

## The product

**A note is a judgment, not a summary.** A summary is shorter content, and shorter content is still content you have to evaluate. The point of the tool is to decide for you whether something was worth the time, and to say so plainly. If the output ever reads like a neutral abstract, the product has failed.

**The verdict has to be unflattering.** Most short-form content repackages standard advice. A scale that rates everything highly tells the reader nothing. The current distribution across 30 real notes is 23 `SOLID BUT FAMILIAR`, 5 `RECYCLED`, 2 `NOVEL`, and zero for both `THIN` and `DUBIOUS`. That is evidence the scale is badly calibrated rather than evidence the content is uniform. See `open-questions.md`.

**"Watch it anyway?" defaults to no.** Yes is reserved for cases where the visual *is* the claim: a physical technique you would perform wrong from a written description, or a demonstration whose outcome is the evidence. Not enough: the video has visuals, seeing it would be nicer, a demonstration illustrates a point the text already made. The reason for the hard default is that a soft yes costs the reader ten minutes and quietly defeats the entire purpose of the tool.

**Record what the creator is selling, even when it does not change the verdict.** The value is the pattern across many notes, not the individual flag. 25 of 30 notes flag a pitch.

**Actions are scoped to seven days and must be concrete.** "Do a ten minute phone-free wind-down before bed on school nights" rather than "prioritise connection". If nothing is actionable the note must say so rather than inventing something, and roughly a fifth of notes legitimately have nothing.

**Notes personalise to the reader's stated context.** The prototype's template names which of the user's two children a piece of advice applies to, rather than defaulting to one. This is also the feature that makes per-user caching impossible, which is the central cost problem in `open-questions.md`.

## The data model

**User state lives apart from the note.** Read and favourite flags are stored in their own collections keyed by note id, never on the note record. The pipeline replaces a note document wholesale when it updates, so a flag stored on the note would be silently wiped. Absence means off, which means a note created tomorrow is unread and unfavourited without anything having to be written for it.

**Derived data should be keyed by a hash of its source.** Audio, and anything else generated from the spoken script, goes stale when the script format changes. Treat it as disposable and regenerate when the hash moves, rather than trying to migrate it.

**Notes are files first.** Markdown that a person can open and edit was worth more than a tidy schema during the prototype, because it made the output inspectable and correctable by hand. A real build should use a database, but should keep markdown export, because the ability to read your own notes without the app is part of the pitch.

## The reading and listening UI

**The spoken script is chunked to 200 characters, sentence-aligned.** Safari truncates long utterances, so everything is queued in small pieces. This turned out to be load-bearing for more than Safari: those same chunks became the timing grid for highlighting.

**Highlighting should be driven by real timings, not estimated.** The prototype estimates position from elapsed time against a characters-per-second constant, so it drifts, and the skip buttons do arithmetic on that estimate rather than seeking. Pre-rendered audio fixes this because each chunk's true start is known. See `tts-pre-rendered-speech.md`, where this is measured.

**Section headings are spoken and highlighted as their own units.** Hearing "Verdict" before the verdict text is what makes a note navigable by ear rather than a wall of prose. Note that the user later found the *verdict label itself* being read before its reasoning to be redundant, which is a different thing and still outstanding.

**Statistics describe what is on screen, not the whole library.** Filtering to unread turns "time to listen" into "time to catch up", which is the question actually being asked.

**The filter controls are collapsed behind one button, with applied filters shown as removable chips.** The controls are sticky, so their height is taken off every screen of reading for the whole session. Collapsing them cut the sticky header by 110px, which is 44% on mobile. The chips exist so that collapsing does not hide the filter state behind a closed menu.

**Anything optional hides rather than degrades.** The read and favourite toggles, the status filter and the export button all disappear when the capability they need is absent, instead of appearing and failing. A control that cannot work is worse than no control.

## The pipeline

**Process one item completely before starting the next.** Any run can be interrupted, by usage limits or anything else. Finishing each video end to end, including marking it processed, means an interrupted run leaves finished work saved and unfinished work untouched, so the next run resumes cleanly and nothing is done twice. An earlier version batched everything and wrote at the end, which was worse in every failure mode.

**Verify before reporting success.** An earlier version logged `rebuilt: yes` without checking, and the library sat eleven notes behind for days with no signal that anything was wrong. Every step that claims to have done something should read it back.

**Always write the log line, even on a no-op run.** Its absence is the only signal that the pipeline has silently died.

**Cap nothing that does not need capping, but stay resumable.** An earlier version capped a run at six videos to avoid exhausting usage. That was removed in favour of per-item durability, which addresses the same risk without artificially limiting throughput.
