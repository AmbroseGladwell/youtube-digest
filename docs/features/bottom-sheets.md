# Bottom sheets

OV-404, from 24 Nov 2026. Every sheet in the app behaves the same on a phone: one entrance,
one exit, the same handle, ×, Escape and focus. What a sheet is on a wider screen is up to
each one: a centred dialog, a popover, a side panel, or a sheet still. The shared piece is
`components/shared/BottomSheet`, first built for OV-399's filter and sort menus (designs
399o-15, 399o-16).

## The behaviour

- **In:** the panel springs up from the bottom over 520ms on the curve the Time saved sheet
  had (design 34ai), and the scrim fades in over 260ms. The owner picked that motion as the
  one to keep.
- **Out:** the panel falls away over 240ms and the scrim fades with it, then the dialog
  closes. The sheet stays mounted while it leaves, so it renders `null` only once it has
  gone; a caller keeps it in the tree and passes `open` rather than mounting it on demand.
  A sheet opened by a value (a menu's place, a playlist pasted, the overviews being filed)
  keeps the last one while it leaves through `useKeptWhileClosing`, so its content doesn't
  empty mid-fall.
- **The handle:** the bar and head drag. Down past half the sheet's height, or a flick
  faster than 0.6px/ms, closes it; up more than 40px takes it to the full height of the
  screen; anything else springs back. Dragging is never the only way: × and Escape always
  close it, and so does a tap on the scrim.
- **The foot** (`foot`) stays at the bottom while the body scrolls behind it. On a short
  screen the whole panel scrolls instead, so the body never shrinks to a sliver.
- **Focus:** a native `<dialog>` with `showModal()`, so the page behind is inert, and Tab is
  held inside (`useFocusTrap`). `initialFocus` names where focus starts; otherwise the first
  control. Once it has closed, focus goes to `returnFocusTo` if given, otherwise to whatever
  had it when the sheet opened. It goes back only if focus is still in the sheet, so a
  sheet opened from another one as it leaves (a timer from the timers list) keeps it.
  Escape stops at the sheet, so it never also reaches the page behind (cooking mode's
  Escape leaves the mode).
- **Reduced motion:** no travel and no fade; it closes at once.

## Options

- `wide="dialog"`: from 48rem a centred card (`width`, 33.75rem by default) that rises
  10px and fades in, and fades down on the way out, with no handle and no drag. Without it
  the sheet stays a sheet at every width, for a caller that shows a popover there itself
  (the filter and sort menus).
- `head`: the sheet's own heading in place of the title (Time saved's figure, Share's
  heading). `title` still names the dialog. `head={null}` with `labelledBy` leaves the
  heading to the body, for a sheet whose heading changes with its steps (Delete account).
- `dismissible={false}`: no ×, and Escape, the scrim and the handle do nothing, while
  nothing may interrupt it (Delete account while it deletes).
- `role="alertdialog"` for a question that has to be answered (Delete overview).
- `onBack`: a back arrow before the title, for a sheet with a second level (the filter
  menu's long lists).
- `onEscape`: Escape steps back a level (out of a rename or a merge in Manage tags) while ×
  still closes the whole sheet.
- `returnFocusTo`: where focus goes when what opened the sheet has gone by the time it closes
  (the account menu's item for Feedback, the selection bar for Add to topic: focus goes to
  Select).

## What uses it

| Sheet | Wider than a phone |
|---|---|
| Filters, Sort, Applied filters | a popover under its button |
| Time saved | a centred card |
| Delete overview, Regenerate article | a centred card |
| New topic, Share, Feedback, Delete account, New overview | a centred card |
| Add to project, Topics for these, New project, Delete project, Delete overviews | a centred card |
| Manage tags, Follow a playlist | a centred card |
| Questions to ask's Change menu, the chat conversation menu | a popover under its button |
| A playlist's pace and order pickers | a menu under the button |
| A timestamp in an overview | a menu beside the tag |
| Edit topics on an overview | a popover under the line |
| About you (Settings, onboarding) | a popover under the sentence; the extension panel keeps its full-screen takeover |
| Cooking mode's Steps, Ingredients, Step in the video, a timer, and leaving with timers | a centred card; a desktop's ingredients are the drawer instead |
| The timers list and a timer's controls outside cooking mode, and "Your timers will stop" | a centred card |
| The model picker (Settings › AI API keys) | a centred card; a phone used to get a full-screen page |
| Plans | a wide centred card with the paid plans side by side; on a phone it opens at the full height (`startsFull`, design 351m) |
| The Ask page's conversations | the drawer at the left |

The questions about timers (leaving cooking mode, timers that will stop) keep their buttons
in the fixed foot. ×, Escape, the scrim and the handle all mean staying.

Chat beside a note (`chats.md`) keeps its own sheet, because it has two heights: raised over
the note, or lowered to its title under the read-aloud bar. It moves on the same curves
(`theme/sheetMotion.scss`). It springs up on opening and raising, and falls away on lowering
and closing. Its handle widens while dragged, and the chat's own × and Escape close it.

No other sheet in the app builds its own scrim, drag or animation. Cooking mode stays full
screen.

## Testing

`bottomSheet.iwft.ts` drives the shared behaviour through the Time saved sheet: resting on
the bottom edge, a short drag springing back, past halfway and a flick closing it with
focus given back, dragging up to full height, × and Escape, travelling down as it leaves,
centred with no drag on a desktop, and closing at once with reduced motion.
`BottomSheetPageObject` reads any sheet by its root.
