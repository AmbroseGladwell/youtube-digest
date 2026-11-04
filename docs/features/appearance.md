# Appearance: theme and accent colour

Design: "OV-135 1–5" (135a–135u) in the Claude Design project `668753e1-e8f2-4709-b7af-f7637cc2f3d6`.
Card: OV-135.

A reader chooses System, Light or Dark, and one of eight accent colours. Both live on the
account, in `Settings.theme` and `Settings.accentColour`, so they follow the reader to every
device. Settings › Appearance sits after Personalisation, its row reads "System · Orange",
and a choice applies as it is made, with no save step.

## The image at the top of a note

Design: "OV-151 1–3" (151n). Card: OV-151. Appearance's third card offers Small or Full width
for the image at the top of every note that has one. It is `Settings.headImageSize`, the same
setting clicking the image on a note writes, so this row gives the choice a name and a way
back after a stray click. Synced like the theme; written on press. How the image looks at
each size is in `docs/features/stone-theme.md`, "Full width".

## The eight accents

Orange, Gold, Lime, Emerald, Teal, Sky, Violet and Raspberry, in wheel order. Stone's rule
holds: there is one accent, spent on actions, progress, search hits and the mark. The reader
chooses which, not how much.

The card first proposed four, on separation under colour blindness: all the accents meet the
same contrast floor, so they share a lightness and only hue tells them apart. The design
round chose eight, for range. Green, Blue and Plum went. The closest pair is Gold and Lime
under protanopia (0.011 OKLab), so the names carry the choice: every tile shows its name and
the chosen one has a check as well as a ring, which is why colour is never the only signal.

Each accent has six light roles and three dark ones, and `--on-action` for its label. Dark
keeps the light `--action` family, as Orange always has. **Orange is `:root` and the dark
block in `tokens.scss`, unchanged; the other seven are the `$accents` map below them.**
`packages/domain`'s `ACCENT_PALETTES` holds the same values for what the stylesheet can't
reach.

**`accentContrast.test.ts` is the guard.** It compiles `tokens.scss`, fails if a value
differs from `ACCENT_PALETTES`, and measures every real pairing for every accent: 4.5:1 for
text and labels, 3:1 for marks, progress and the focus ring. A new accent or a changed hex
has to pass it.

**Gold has a bright fill and dark labels.** A yellow that carries a white label is the colour
of mud, so Gold's `--action` is #f7c900 under an ink `--on-action` (11.5:1), and its marks and
text on light use a deep gold. The fill is 1.44:1 against the light ground; that passes because
the label identifies the button and a labelled button needs no visible edge. Nothing else may
rely on `--action` for its shape. A new use of `--action` as an unlabelled indicator would fail
on Gold, so use `--brand`.

Left out: red reads as an error, a neutral graphite can't be told from the ink "active" pill,
and a custom colour couldn't be held to the floor.

## Failure is not an accent

`--accent` used to double as the failure colour, and a green failure reads as success.
**`--alert` is fixed**: #b03c12 light, #f0794a dark, under every accent, so Orange readers see no
change. Failed runs, form errors, "No matches", the dubious flag, destructive actions, parked
writes and the bar over a refused or stopped link all use it. Every failure also carries a
word and usually an icon. Raspberry is the accent nearest the alert (0.107); the design chose
that over a second alert scheme with its own measurements to hold.

**When adding a colour to a screen:** a thing going wrong is `--alert`; anything else is
`--accent` or `--brand`.

## Contrast fixes that came with it

- Link text on `--action` (`UsageLine`, `PlanUsage`, `KeyPromptNote`, `AddProviderKeyRow`)
  failed 4.5:1 and moved to `--accent`.
- The current search hit was a label on `--brand`, at 3.87:1, and is now on `--action`.
- A chosen accent tile keeps the card and takes a ring and a check rather than the house stone
  tint and ring, because Orange on the tint is 2.94:1.
- The orange YouTube button's dark ready hover was 4.11:1 at its lightest and is now 4.6:1.

## No flash

The settings store opens asynchronously, far too late for first paint. So `AppearanceRuntime`
keeps a device copy in `overview.appearance.v1`, and `public/appearance.js`, a blocking classic
script in the head, reads it before anything paints. It is an external file because MV3 forbids
inline scripts. It is deliberately plain: no imports, and the same file in both shells, which
`appearanceScript.test.ts` holds, along with its accent list. `color-scheme` is set on the root
too, or an override would leave scrollbars and native controls in the device's scheme.

`data-theme` is absent for System and `data-accent` is absent for Orange, so a reader who has
chosen nothing is on the stylesheet's defaults. System follows the device through the media
query alone.

## Signed out

The device keeps the look it last had. Sign-out opens the no-account library, whose settings
are the defaults, and honouring them would change the sign-in page under the reader.
`useAppearance` therefore reads the device copy when there's no account and nothing chosen
(and while the store is still opening). Signed out, a reader can still choose: it saves to
that library, and `moveAnswersInto` carries it into an account that still has the defaults. The
account's own choice wins.

## The logo

The in-app mark is `--mark`, so it follows. Outside the page, **icons use the light `--brand` in
both themes**, because the browser's own chrome doesn't follow ours: Sky's dark value would be
close to invisible on a light toolbar.

| Where | How |
|---|---|
| Web favicon | `apps/web/public/favicons/{accent}.svg`, swapped through `data-accent-href` |
| Extension pages' favicon | `public/icons/accents/{accent}/icon.svg`, the same way |
| Toolbar icon | `chrome.action.setIcon` with `icons/accents/{accent}/icon16.png` and `icon32.png` |
| Button on YouTube | `overviewButtonAccent.ts` writes its rules; Orange keeps the hand-set ones |

The worker and the content script can't read the page's storage, so `AccentMirrorContext` hands
the accent to `chrome.storage.local`, as `ErrorDestinationMirrorContext` does for errors. Chrome
forgets `setIcon` when the profile closes, so the worker applies it at the top level and on
`runtime.onStartup`. `accentPalette.ts` is free of zod and has its own package export because the
content script runs on every YouTube page: importing the domain package whole took it from 11 kB
to 162 kB.

The PNGs are the hand-tuned orange set recoloured pixel for pixel with their alpha kept, which
is how each size keeps its own stroke.

**Stays orange:** `manifest.json`'s icons (fixed at build: `chrome://extensions`, the install
prompt, the Web Store) and the Apple touch icon (copied by iOS when added to the home screen).
Emails and share cards stay orange by choice, because other people read them. Safari's tab may
keep the `.ico`, which is the degraded state. Milestones are their own scale.

## Not in scope

Custom colours, per-device settings, asking in onboarding, and changing the neutrals.
