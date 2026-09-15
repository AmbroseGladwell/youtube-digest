# Frontend Architecture Guide: Route Transitions, Animation, and State

Adopted for this project's shared `packages/app-core` — the single Vite + React +
React Router app mounted verbatim by both the Chrome extension and the web app (see
`docs/architecture/v1-architecture-decisions.md`). It was written against a different codebase and
handed over with its project-specific bits (design-system paths, route names, domain
types) stripped to placeholders; the stack it assumes — React 19, TypeScript, React
Router, TanStack Query v5, SCSS Modules — matches this project's actual choices
exactly, so it applies without adaptation. Replace the placeholder route names and
domain types below with this project's real ones (`Routes.digest(...)`, `DigestId`,
etc.) as `app-core` is actually built.

Apply these conventions when building or extending a React SPA that talks to a REST
backend. They produce an app where navigation feels continuous rather than like a
series of hard cuts, and where interactions land instantly instead of waiting on the
network.

---

## Part 1 — Route architecture

Everything in Part 2 depends on this. Get it right first.

### 1.1 Build a persistent shell

Nest layout routes so that chrome (header, nav, sidebar, any always-visible panel)
**stays mounted across navigations** and only the innermost region swaps.

```tsx
export const router = createBrowserRouter([
  {
    element: <AnalyticsRouteContext />,           // cross-cutting, never unmounts
    children: [
      { path: Routes.welcome(), loader: welcomeLoader, element: <WelcomePage /> },
      {
        path: '/',
        loader: sessionLoader,                     // auth gate lives in a loader
        element: <RootLayout />,
        errorElement: <RouterErrorBoundary />,
        children: [
          {
            element: <OnboardingGate />,
            children: [
              { path: Routes.onboarding(), element: <OnboardingWizard /> },
              {
                element: <AppChrome />,             // header + nav: persistent
                children: [
                  {
                    element: <PrimaryLayout />,     // background content: persistent
                    children: [
                      { index: true },
                      {
                        element: <Pane />,          // THE thing that swaps
                        children: paneRoutes,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
```

**Rules**
- Identify the single region that changes per route. Name it something concrete
  (`Pane`, `Detail`, `Workspace`). It is the transition unit.
- Layout components are thin: chrome plus `<Outlet />`, nothing else.
- Gate auth/onboarding with **loaders**, not with conditional rendering inside
  components — a component that conditionally returns `null` destroys the shell.
- `errorElement` at the top of each authenticated subtree, logging the route error.

**Why:** the View Transitions API animates between two snapshots of the *same* DOM.
If the whole page unmounts and remounts, there is no shared structure to interpolate
and you get a cross-fade at best. A persistent shell is the prerequisite, not a nicety.

### 1.2 Never hardcode routes

One typed route factory owns every path, query param, and URL-segment transform.

```ts
export const Routes = {
  home: '/',
  items: '/items',
  itemEdit: (itemId: ItemId) => `/items/${itemId}`,
  collection: (collectionId: CollectionId) => `/collections/${toUrlSegment(collectionId)}`,
  onboarding: ({ page }: { page?: PageNumber } = {}) =>
    `/onboarding${optionalSearchStringSuffix({ [PAGE_QUERY_PARAM]: page })}`,
}

export const RouteParams = makeRouteParams({ itemId: 'itemId', collectionId: 'collectionId' })
```

Use it everywhere — `navigate()`, `<Link>`, `<Route path>`, tests, path assertions.
Route definitions reference params through it too:
`{ path: Routes.itemEdit(`:${RouteParams.itemId}`) }`.

**Why:** the factory is the single place that knows about encoding and query params.
A parallel string literal in a test silently rots.

---

## Part 2 — Animation and route transitions

### 2.1 Use the native View Transitions API. Do not install an animation library.

`motion` / `framer-motion` / `react-transition-group` are for *component-local*
animation (a banner sliding in, a spinner). They are the wrong tool for route
transitions: they require you to keep both trees mounted, they don't interpolate
across a router boundary, and they add bundle weight for something the browser now
does natively.

For route transitions use `document.startViewTransition`, driven by React Router's
`viewTransition` navigation option.

### 2.2 One gate for "should we animate?"

Create exactly one module that answers this. Every call site goes through it.

```ts
// util/viewTransitions.ts
const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

// Mirrors the `desktop($landscape-aware: true)` breakpoint in the SCSS theme.
const desktopLandscapeQuery = '(width > 700px) and (height > 500px)'

const supportsViewTransitions = (): boolean => typeof document.startViewTransition === 'function'

export const canUseViewTransitions = (): boolean =>
  supportsViewTransitions() && !matchMedia(reducedMotionQuery).matches

export const shouldAnimateNavigation = (): boolean =>
  canUseViewTransitions() && matchMedia(desktopLandscapeQuery).matches

// Same gate, made reactive: the subscriptions exist only to re-render on change.
export const useShouldAnimateNavigation = (): boolean => {
  useMediaQuerySubscription(reducedMotionQuery)
  useMediaQuerySubscription(desktopLandscapeQuery)
  return shouldAnimateNavigation()
}
```

**Rules**
- Export both an event-time function and a reactive hook. Event handlers call the
  function; anything that must re-render on viewport change uses the hook.
- Three checks, always: **feature detection**, **`prefers-reduced-motion`**, and a
  **viewport check**. Full-screen push transitions on a phone usually read as jank,
  not polish — gate them to desktop/landscape unless you have designed the mobile case.
- **Export the breakpoint from one shared constants module, consumed by both the JS
  and the SCSS**, rather than duplicating the number in each. See "Known trade-offs"
  at the end of this doc for why a reference implementation carries the duplicated
  version instead, and why this project doesn't inherit it.
- Unit-test this module: it is small, pure, and the thing most likely to silently
  disable every animation in the app.

Call sites:

```ts
navigate(Routes.home, { viewTransition: shouldAnimateNavigation() })
```

### 2.3 Opt elements in via a theme mixin, never a raw property

```scss
// theme/helpers/animation.scss
@mixin animation($rule...) {
  @media (prefers-reduced-motion: no-preference) { animation: $rule; }
}

@mixin transition($rule...) {
  @media (prefers-reduced-motion: no-preference) { transition: $rule; }
}

@mixin view-transition-name($name) {
  @include desktop($landscape-aware: true) { view-transition-name: $name; }
}
```

**Rules**
- Never write bare `animation:`, `transition:`, or `view-transition-name:` in app code.
  Go through the mixins so `prefers-reduced-motion` and the breakpoint gate are
  impossible to forget. This makes accessibility the default rather than a review item.
- Keep the named set small and deliberate — under ~10 names for a whole app. Name only:
  the swapping region, persistent chrome that overlaps it, and specific elements that
  should *morph* between two routes (a heading that moves, a timer that stays put).
- `view-transition-name` must be unique per document at transition time. Two elements
  sharing a name aborts the transition silently.

### 2.4 Choreograph in one dedicated stylesheet

Put all `::view-transition-*` rules in one file next to the swapping region
(e.g. `Pane/paneTransitions.scss`). Four things need handling — all four are
non-obvious, and skipping any of them is where "native view transitions look cheap"
comes from:

```scss
$enter-duration: 300ms;
$enter-easing: cubic-bezier(0.2, 0, 0, 1);
$leave-duration: 200ms;
$leave-easing: ease-in;

@keyframes pane-enter {
  from { opacity: 0; transform: translateX(-20%); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pane-leave {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-20%); }
}

// 1. Opt the root out of capture. Removes the default full-page cross-fade (and
//    Chrome's plus-lighter dimming with it) and keeps un-named content live and
//    interactive throughout the transition.
:root {
  view-transition-name: none;
}

// 2. Translucent chrome that paints ABOVE the swapping region must be captured too,
//    or its snapshot ordering will make it pop. It's identical before and after, so
//    cross-fading the two snapshots visibly shifts its density: paint only the new
//    one, held steady.
::view-transition-group(app-header),
::view-transition-new(app-header),
::view-transition-group(nav-actions),
::view-transition-new(nav-actions) {
  animation: none;
  opacity: 1;
}
::view-transition-old(app-header),
::view-transition-old(nav-actions) {
  animation: none;
  opacity: 0;
}

// 3. Restore on-screen stacking. Snapshot groups stack in new-state paint order with
//    old-only groups underneath — so a closing pane would slide BEHIND content that
//    exists in both states. Re-assert the real z-order.
::view-transition-group(pane)       { z-index: 1; }
::view-transition-group(app-header),
::view-transition-group(nav-actions) { z-index: 2; }

// 4. Distinguish enter from leave from morph. `:only-child` means the snapshot has no
//    counterpart — new-only is entering, old-only is leaving. When both exist the
//    browser's default morph is usually what you want; leave it alone.
@include desktop($landscape-aware: true) {
  ::view-transition-new(pane):only-child { @include animation($enter-duration $enter-easing both pane-enter); }
  ::view-transition-old(pane):only-child { @include animation($leave-duration $leave-easing both pane-leave); }

  // Elements present in both states: retune the default morph, don't replace it.
  @media (prefers-reduced-motion: no-preference) {
    ::view-transition-group(shared-heading),
    ::view-transition-group(shared-timer) {
      animation-duration: $enter-duration;
      animation-timing-function: $enter-easing;
    }
  }
}
```

**Rules**
- **Enter and leave get different durations and curves.** Leave should be faster
  (~200ms, ease-in); enter slower with a decelerating curve (~300ms). Symmetric
  timings feel sluggish.
- The reasoning for every non-obvious rule above is written out here, in this
  section, not restated as a code comment (`CLAUDE.md`'s near-zero-comments policy).
  Where a reader could otherwise mistake one of these four for dead code and delete
  it, point back at this section in a single line rather than re-explaining it.
- Test with a translucent header. Most snapshot-stacking bugs only appear there.

### 2.5 Animate list reorders with view-transition types

For a list that re-sorts in place, decouple *data order* from *displayed order* so you
can drive the reorder through a transition:

```ts
export const useAnimatedOrder = <T,>(items: T[], keyOf: (item: T) => string): T[] => {
  const ordered = useMemo(() => sortItems(items), [items])
  const [displayed, setDisplayed] = useState(ordered)
  const previous = useRef(ordered)

  useEffect(() => {
    if (previous.current === ordered) { return }
    const orderUnchanged = haveSameOrder(previous.current, ordered, keyOf)
    previous.current = ordered

    const commit = (): void => setDisplayed(ordered)
    if (orderUnchanged || !canUseViewTransitions()) {
      commit()
      return
    }
    // flushSync commits the reorder to the DOM before startViewTransition captures
    // the "after" snapshot; on React 19 the <ViewTransition> component replaces this.
    // See "Known trade-offs" at the end of this doc.
    const transition = document.startViewTransition(() => flushSync(commit))
    // `types` is undefined on browsers predating view-transition types, despite the
    // DOM lib typing it as always present.
    transition.types?.add('list-reorder')
  }, [ordered, keyOf])

  return displayed
}
```

Then target that specific transition in CSS using a **view-transition class**
(`.name`, applied via `view-transition-class` on the items) plus the active type:

```scss
// The browser default (250ms) reads as too quick for a reorder.
@media (prefers-reduced-motion: no-preference) {
  :root:active-view-transition-type(list-reorder)::view-transition-group(.list-item) {
    animation-duration: 350ms;
  }
}
```

**Rules**
- Bail out early when the order is unchanged — don't pay for a transition on a
  content-only update.
- Use `transition.types` to scope CSS to *this* kind of transition. Without it your
  reorder tuning leaks into navigation transitions.
- Both the `flushSync` and the `types?.` optional chain need the comments above.
  They look like mistakes otherwise.

### 2.6 Keep component-local animation in SCSS

For everything that isn't a route transition — skeleton shimmer, button feedback,
a dialog sliding in — plain SCSS `@keyframes` / `transition` through the theme mixins.
Reach for a JS animation library only for genuinely interactive physics (drag, spring
follow, gesture-driven). "It has a nice API" is not a reason to ship 30kB.

---

## Part 3 — Server state

### 3.1 Use TanStack Query. Do not put server data in a global store.

Redux/Zustand/a homegrown store all require you to hand-roll caching, invalidation,
loading and error states, stale-while-revalidate, and optimistic rollback. TanStack
Query ships all of it. Use a client-state store only when client state is genuinely
complex — and add it later, as a small PR, rather than up front.

This is the app's sole data layer — not paired with any framework-level data fetching
(there's no server-rendering framework here to pair it with; see
`docs/architecture/v1-architecture-decisions.md` on dropping Next.js).

### 3.2 Keep the client config tiny

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, networkMode: 'always', retry: 0 },
    mutations: { networkMode: 'always' },
  },
})
```

- `staleTime` of ~60s: navigating back to a page you just left should not refetch.
- `retry: 0`: surface failures immediately rather than hanging the UI for 3 attempts.
  Retry deliberately, per-query, where it's actually warranted.
- `networkMode: 'always'`: don't let the library's online heuristic pause mutations.
- Mount devtools, and gate a production-devtools build behind a debug flag.

### 3.3 Organise by feature slice, not by technical layer

```
features/<feature>/
  api/<feature>Api.ts                  # HTTP client, interface + impl
  <feature>Keys.ts                     # query key factory
  queries/<thing>Query.ts              # queryOptions + hook
  mutations/<verb><Thing>Mutation.ts   # one file per mutation
  types/<Thing>.ts                     # type + colocated schema
  types/<Thing>Factory.testHelper.ts   # test data builders
  util/<pureFunction>.ts               # pure, unit-tested
  components/<page>/<Component>.tsx
```

No `src/api/`, `src/hooks/`, `src/types/` grab-bags. A feature is deletable in one
`rm -rf`. Shared cross-feature components live in `components/shared/`; app shell and
providers in `app/`.

### 3.4 Hierarchical key factories

```ts
export const itemKeys = {
  all: ['item'] as const,
  lists: ['item', 'list'] as const,
  list: (collectionId?: CollectionId, filterId?: FilterId) =>
    [...itemKeys.all, 'list', { collectionId, filterId }] as const,
  detail: (itemId: ItemId) => [...itemKeys.all, 'detail', itemId] as const,
}
```

**Rules**
- Never inline a key array at a call site.
- Structure them so `all` / `lists` are meaningful invalidation targets — you want to
  invalidate a subtree, not the whole cache and not one exact key.
- Filter params go in a trailing object, not as positional array members.

### 3.5 Export `queryOptions()` separately from the hook

```ts
export const itemsQueryOptions = (params: ItemsQueryParams = {}, api: ItemApi = itemApi) =>
  queryOptions({
    queryKey: itemKeys.list(params.collectionId, params.filterId),
    queryFn: async (): Promise<Item[]> => {
      const result = await api.getItems(params)
      switch (result.type) {
        case ResultType.SUCCESS:
          return result.response.items
        case ResultType.UNEXPECTED_ERROR:
          throw new Error('Failed to load items')
      }
    },
  })

export const useItemsQuery = (params: ItemsQueryParams = {}) => useQuery(itemsQueryOptions(params))
```

**Rules**
- The `queryOptions` object is the reusable unit — it can be prefetched, used in a
  loader, or unit-tested without rendering. The hook is a one-line convenience.
- **Inject the API as a defaulted last parameter.** This is what makes the query
  testable without module mocking.
- Translate a typed `Result` union into resolve/throw inside `queryFn` with an
  exhaustive `switch`, so a new error variant is a compile error.

### 3.6 Optimistic updates are the default for mutations

This is half of why the app feels fast. Full pattern:

```ts
export const applyPatchRequest = (item: Item, request: PatchItemRequest): Item => ({
  ...item,
  name: request.name?.value ?? item.name,
  status: request.status?.value ?? item.status,
  // Mirror backend semantics here — e.g. changing the parent clears the child ref
  // unless the request sets one explicitly.
  description: applyEdit(request.description, item.description),
})

export const usePatchItemMutation = (api: ItemApi = itemApi) => {
  const queryClient = useQueryClient()

  return useMutation<void, Error, PatchItemVariables, PatchItemContext>({
    mutationKey: itemKeys.all,
    mutationFn: async ({ itemId, request }) => { /* throw on failure */ },

    onMutate: async ({ itemId, request }) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all })

      const previousLists = queryClient.getQueriesData<Item[]>({ queryKey: itemKeys.lists })
      const previousDetail = queryClient.getQueryData<Item>(itemKeys.detail(itemId))

      queryClient.setQueriesData<Item[]>({ queryKey: itemKeys.lists }, (previous) =>
        previous?.map((item) => (item.id === itemId ? applyPatchRequest(item, request) : item)),
      )
      queryClient.setQueryData<Item>(itemKeys.detail(itemId), (previous) =>
        previous ? applyPatchRequest(previous, request) : undefined,
      )

      return { previousLists, previousDetail }
    },

    onError: (error, { itemId }, context) => {
      if (context) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data)
        }
        if (context.previousDetail) {
          queryClient.setQueryData(itemKeys.detail(itemId), context.previousDetail)
        }
      }
      updateOrCreateToast(PATCH_ERROR_TOAST_ID, 'Something went wrong updating the item.', {
        toastType: 'error',
      })
    },

    onSettled: async () => {
      // Only refetch once the LAST in-flight mutation settles, so rapid toggling
      // doesn't thrash the network or fight the optimistic state.
      if (queryClient.isMutating({ mutationKey: itemKeys.all }) === 1) {
        await queryClient.invalidateQueries({ queryKey: itemKeys.all })
      }
    },
  })
}
```

**Rules**
- Extract a **pure `apply<Verb>Request(entity, request)` function**. It is shared by
  the optimistic path and its unit tests, and it is the one place that must mirror
  backend write semantics. Give any rule that mirrors the backend a shared contract
  test that fails the moment the two drift — a comment here only documents the hope
  that they stay in sync, and can't catch it when they don't.
- **Patch every cache the entity appears in** — all matching lists (`setQueriesData`
  on the `lists` prefix), the detail entry, and any *derived* list in another feature
  (e.g. a "today" view that filters on a field this mutation changes; re-run the
  filter after patching so items correctly drop out).
- Snapshot everything you patch and restore all of it in `onError`, plus a
  deduplicated toast keyed by a stable id.
- The `isMutating(...) === 1` guard in `onSettled` is the difference between a
  checkbox that feels instant and one that flickers under rapid clicking. Include it.
- Give related mutations a shared `mutationKey` so that guard can see them.

### 3.7 Skeletons, never spinners

Build a skeleton per content *shape* — `ItemCardSkeleton`, `ItemListSkeleton`,
`CollectionCardSkeleton` — matching the real component's dimensions, and render it on
`isPending`. A skeleton that matches the incoming layout means no reflow when data
arrives; a centred spinner guarantees one.

---

## Part 4 — Client state

### 4.1 React primitives first

No client-state library until genuinely warranted. In practice the tiers are:

1. **URL** — the default. Selected entity, open detail, wizard page, filters. Routed
   through the typed route factory. Free back/forward, deep-linking, and sharing.
2. **`useState`** local to a component — transient UI (hover, open menu, draft input).
3. **A form library** for forms — don't hand-roll validation and dirty tracking.
4. **Context + `useReducer`** — only for genuinely app-wide, long-lived client state.
   Expect **one or two of these in an entire app**. More than that means state that
   should live in the URL or in the query cache has leaked into React.

A likely candidate for one of those one-or-two app-wide contexts in this project: the
audio player (currently playing note, position, queue), since playback needs to
survive navigation across the whole app, not just within one route.

### 4.2 Persist long-lived client state deliberately

When a context must survive reload (a running timer, a draft):

- Route through a small typed storage abstraction, not raw `localStorage`.
- Scope the key by product **and** user — never let one user's state bleed into
  another's session on a shared device.
- **Validate on read against a schema** and fall back to a declared default. Persisted
  shapes outlive the code that wrote them; unvalidated reads crash on deploy.
- Split contexts by update frequency. A timer ticking at 250ms goes in its own context
  from the controls, or every consumer re-renders four times a second.

---

## Part 5 — Review checklist

**Routing / transitions**
- [ ] Chrome stays mounted across navigation; exactly one region swaps.
- [ ] No hardcoded route strings anywhere, tests included.
- [ ] Every `navigate` that should animate passes `viewTransition: shouldAnimateNavigation()`.
- [ ] Feature detection + `prefers-reduced-motion` + viewport, all in one gate module, unit-tested.
- [ ] No bare `animation:` / `transition:` / `view-transition-name:` — mixins only.
- [ ] Fewer than ~10 `view-transition-name`s; each unique at transition time.
- [ ] `:root { view-transition-name: none }` set.
- [ ] Snapshot `z-index` asserted for anything overlapping the swapping region.
- [ ] Enter and leave have different durations and curves.
- [ ] Every non-obvious `::view-transition-*` rule carries a one-line *why*.

**State**
- [ ] No server data in a global client store.
- [ ] Every query key comes from a hierarchical factory.
- [ ] `queryOptions` exported separately; API injected as a defaulted param.
- [ ] Write mutations are optimistic, patch every affected cache, and roll back with a toast.
- [ ] `isMutating(...) === 1` guard before invalidating in `onSettled`.
- [ ] Shape-matched skeletons, not spinners.
- [ ] Two or fewer app-wide contexts; persisted state is schema-validated and user-scoped.

---

## When this approach does *not* fit

Be honest about the boundary. This architecture assumes **request/response REST with a
server as source of truth**. It is a poor fit for:

- **Offline-first apps** with local durable storage as the primary store.
- **Real-time collaborative apps** syncing via event deltas / CRDTs / WebSockets, where
  state arrives unsolicited rather than being fetched.
- **Long-running device/media pipelines** (recording, workers, streams) whose state is
  a side effect, not a resource.

For those, an event-sourced or command-oriented store is the right call, and forcing a
query cache on top of it fights the grain. Apply Part 2 (transitions) regardless —
it is independent of how data is fetched, and it is where most of the perceived
polish comes from.

Note for this project specifically: the **free tier's local storage** (no server,
BYO key) is closer to this excluded category than to the REST-backed model the rest
of this guide assumes. The guide's routing and animation conventions (Parts 1–2)
still apply everywhere. Its server-state conventions (Part 3) apply as written to the
**paid path**, talking to the Fastify API; the free path's local `DigestStore`
implementation should be designed on its own terms rather than forced through
TanStack Query against nothing.

---

## Known trade-offs, carried over deliberately

- **The duplicated breakpoint** (a JS media query mirroring a SCSS breakpoint) is a
  known weak point in the reference pattern §2.2 is based on, held together there by
  a comment tying the two together rather than removed. This project doesn't inherit
  that: §2.2 requires exporting the breakpoint from one shared constants module
  consumed by both the JS and the SCSS instead, which removes the duplication rather
  than documenting it — there's no legacy SCSS setup here forcing the split, so
  there's no reason to start from the version that needs a comment to hold together.
- **§2.5's `flushSync` pattern has a shelf life.** React 19's `<ViewTransition>`
  component supersedes it. It's kept because it's what works today and is portable,
  not because it's the long-term answer — expect to replace it once `<ViewTransition>`
  is adopted.
