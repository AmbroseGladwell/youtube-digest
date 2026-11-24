# Navigation: Overviews, Projects and Ask

OV-399, built 24 Nov 2026 from the design round agreed with the owner that day (canvas
399a–399s, hand-off `design_handoff_ov399_navigation/`). Overviews, Projects and Ask are the
three top-level pages; + New is the one action; Settings stays in the account menu. The
library's rail is gone: its filters moved into the filter menu (`library-filters.md`, "The
menu"), and its projects, queue link and time saved moved into the sidebar below.

## The masthead

**Wide screens (C1, 399c-4).** The logo, then the orange **Ask** and **+ New** pills and the
account on the right. Ask is a page, so on it its pill is ringed and carries
`aria-current="page"`. The masthead holds no page links: they are in the sidebar.

**Phones (D, 399d).** The logo's mark (the name stays as the heading for screen readers),
then **Overviews** and **Projects** as icons named by their tips and accessible names, the
orange **Ask** and **+** circles, and the account. The current page's icon sits on a surface
circle with `aria-current="page"`. Every circle is 44px, as OV-380 holds the bar (the design
draws the page icons at 40); below about 340px wide (400% zoom on a phone) they drop to 40px
so the bar still fits at 320px. At 200% text they grow with it and wrap to a second row
rather than run off the screen. While the bar holds a page's way back (`back-within-reach.md`),
the page icons give way so its label fits.

D applies under 48rem, and to a phone on its side: `(pointer: coarse) and (max-height:
31.1875rem)`, so a short desktop window keeps the wide layout.

**The extension panel** keeps its own masthead: the logo, + New and the account menu.

## The sidebar

`AppSidebar`, in the shell beside the pane, on the pages that are lists or top-level: the
library, a project, Projects, the queue and Ask. Not on an overview, Settings or the policy
pages, and not before the library has anything in it (the first-run hero stays as it was).

Top to bottom:

- **Overviews** and **Projects**, with an orange dot for the current one, and **Queue** with
  its count only while something is queued ("1 needs you ·" in the alert colour when
  something needs attention).
- **Projects** (a Gloock heading, + for New project): five, last changed first, each with a
  colour mark and its count, the current project kept in the list if it falls past five, then
  "All projects" (or "All N projects · N archived"). The mark is one of six tokens
  (`--project-mark-1` to `6`), picked from the project's id by `projectMarkColour`: projects
  store no colour.
- **Topics** (+ for New topic): up to 7, each with its count and a bar for how much of it is
  read, named "Psychology, 6 overviews, 2 unread". "Show all N topics" opens the rest in
  place. Choosing a topic opens the list filtered to it, keeping the rest of the view (the
  current one on the list, the saved one from elsewhere), and saves that view; choosing it
  again clears it. The topic becomes the page's title, with "Topic · N overviews · N unread"
  under it. Its chip stays in the chip line, so Reset and × still clear it.
- **Time saved** at the foot: the figure, a bar to the next milestone in that milestone's
  colour and "Next: 50 hours · 740 min to go". It opens the same Time saved dialog as before.
  Its name is its own text, with the figure's words hidden beside the rolling digits, so what
  is said matches what is shown.
- **Hide sidebar**, under Time saved, tip "Hide sidebar · [".

**Open or hidden.** Open by default from 62rem (desktop and tablet landscape), hidden by
default below it (tablet portrait, an unfolded foldable). Opened there, it pushes the list,
which narrows; nothing is dimmed. Hidden, a floating button in the bottom left ("Show sidebar
· [", above the mini player) brings it back. `[` toggles it either way, except while typing
in a field or with a dialog or menu open. The choice is remembered on the device
(`sidebarStorage`, one value, open or hidden); with none, the width decides. It slides over
240ms and switches at once with reduced motion. Hiding by the button moves focus to the
floating button, and showing moves it to Hide sidebar.

The list beside it is centred in a 900px column (`LibraryPage`'s `.main`, and the Projects
page's).

**The milestone chip** the design puts above the figure when a milestone is reached is not
built: the milestone cards above the list still announce it, as before.

## Where things went without the sidebar

On a phone, or with the sidebar hidden, the page shows what the sidebar would have:

- **Time saved** beside the heading, "37h 40m saved", opening the dialog.
- **The queue** as a line under the chip line, "3 in the queue · See queue" (`QueueLine`),
  only while something is queued, on the Overviews page only. The capture strip under the
  masthead still shows while something is being made. The queue is no longer in the filter
  menu: it isn't a filter.
- **Projects** through the masthead's Projects icon; **topics** through the filter menu's
  Topic group.

`SidebarContext` tells the page whether the sidebar is on screen.

## Projects as its own page

`/projects` renders `ProjectsPage` (the list of projects and New project) rather than the
library in a projects mode; `LibraryPlace` no longer has a `projects` kind. A single project
is still the library's list scoped to it, so search, sort, filters and selecting work there
as before, and its way back still says "All projects". The Projects page lends no way back of
its own: it is a top-level page.

Page slides between the three top-level pages follow their order (Overviews, Projects, Ask):
`navigationDirection` in `viewTransitions.ts`.

## Analytics

- `app.nav.pageChosen` with `page` (overviews, projects, ask, queue) and `from` (masthead,
  sidebar, queueLine).
- `app.nav.quickAccessChosen` with `kind` (project or topic) for a project or topic chosen in
  the sidebar. Never which one.
- `app.sidebar.toggled` with `open` and `by` (button or key).
- New project from the sidebar is `projects.newProjectDialog.opened` with `from: "sidebar"`
  (it was `rail`). New topic and Time saved keep their events.
- Gone with the rail: `app.masthead.overviewsChosen` and `projects.rail.*`.

## Testing

`navigation.iwft.ts`: the sidebar's pages, projects and topics with the current one marked,
a topic as the title, hiding and showing by button and `[`, the choice kept, `[` in the
search, a tablet held upright, pages without a sidebar, the phone's icons, and a phone on its
side. `projects.iwft.ts` reaches projects through the sidebar on a wide screen and the
Projects icon on a phone; `stickyRails.iwft.ts` holds the sidebar to the masthead.
