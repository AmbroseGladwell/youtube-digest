# Settings is a short list of sections

Design: "OV-51 Settings Sections" (51a–51g). Card: OV-51.

Settings used to be one long column: the voice picker, the plan, the key note, the keys,
sync and the build line, one after another. More settings are coming (personalisation,
connections, shared links), so the page is now a list of sections. Each section has its own
route and its own page.

## The sections

In order, each with the value its row shows:

| Section | Route | Row value | Shown when |
|---|---|---|---|
| Account & sync | `/settings/account` | first name (or email) · the sync status line; signed out, "Not signed in · this library stays here" | the shell can sync |
| Narration voice | `/settings/voice` | voice · accent | there is narration (signed in) |
| API keys | `/settings/keys` | whether the Anthropic key is set · model | always |
| Connections | `/settings/connections` | "N connected" or "None" on Plus, "Needs Plus", or "Sign in first" | the shell can sync |
| Milestones | `/settings/milestones` | the time saved · how many of the ten milestones are reached, e.g. "9h 47m saved · 3 of 10" | always |
| Shared links | `/settings/shared` | "3 shared", or "None" | there is an account to share under (`docs/features/sharing.md`) |
| Plan | `/settings/plan` | Free or Plus | always |
| About | `/settings/about` | the version | the shell knows its build |

A section whose panel would show nothing is left out, both its row and its route. Its
address then opens Settings as `/settings` would (`CLAUDE.md`, "degrade visibly").
`useSettingsSections` decides this, and `settingsRowValues` writes the row values from what
each panel already reads.

Plan is its own section rather than part of Account, so a Free reader with no account still
finds it. It comes after Connections: below the things people change, above About.

New sections go here: Personalisation (OV-46) after Narration voice, YouTube playlists
(OV-27) beside Connections, and Privacy (OV-62) between Plan and About, whose id is already
reserved (`analytics-consent.md`). About stays last. Connections is described in
`mcp-connector.md`, Milestones in `time-saved.md`, Shared links in `sharing.md`.

## Two panes, or a list then a page

- **Wide (51a, 51c):** the list is on the left and the chosen section is on the right, capped
  at 600px. The current row takes the stone tint with a stone ring, plus
  `aria-current="page"`. `/settings` shows the first section. Tabs were considered and
  rejected: they lose each row's value and wrap at eight sections.
- **Phone and the side panel (51d–51g):** the list is the page. Each row opens its section
  on a page of its own, with "Settings" kept under the masthead as the way back (43h's header,
  reused for every section). Below 768px the layout switches, using `PHONE_QUERY`, the same
  breakpoint the rest of the app uses. The panel always uses this layout.

Every section heads itself with an `h2`, and arriving on a section by its route moves focus
to that heading. The list is a `nav` named "Settings sections".

## Deep links

- The player bar's voice link goes to `/settings/voice`. The picker scrolls the reader's
  voice into view, as it did before (43i).
- Every "set up your keys" link goes to `/settings/keys`: the home page, the new-overview
  form, the panel's capture screen, and the injected button when keys are missing.
- The panel's "See Plus" note goes to `/settings/plan`.
- The account menu's Settings item goes to `/settings`.

## Account & sync

Signed in, the section is 51a's two tiles: **Signed in as** (first name, then the email in
muted text) and **Sync** (the status line, with a tick when nothing is waiting, then Sync
now and, on the web, Connect the extension). Sign out sits below the tiles as a quiet
button. A session the server has forgotten swaps Sync now for Sign in again. Signed out,
there is one Sync tile that points at the sign-in and create-account pages.

## Ways back

The main Settings page, which is the list (and on a wide screen the list with a section
beside it), leads back to the library: "All overviews", or "Back" in the panel. A section on
its own page, on a phone or in the panel, leads back to the list: "Settings", kept under the
masthead.

Going from the list into a section uses the forward transition, and going back to the list
uses the back one. Switching between two sections, which on a wide screen swaps only the
pane, uses neither.

## Where the build departs from the design

- **"All overviews" stays on the main page.** The design draws no way back to the library,
  but Settings had one before and keeps it.
- **The extension's separate-library note** is now the Account section's signed-out hint:
  "The extension keeps its own library until you sign in." When the shell cannot sync, the
  Account section is hidden and the note goes with it. The extension's home page still says
  it.
- **About shows only the build line for now.** It is its own section so that it has room to
  grow. A privacy link will go there once there is a privacy page.
- **No screenshot tests.** The card asks for screenshots at 1200, 390 and 400×600, but this
  repo has no screenshot harness yet. The layouts are covered by
  `settingsSections.iwft.ts` at desktop and phone widths, and by the panel scenarios.
