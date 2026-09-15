# Frontend Testing Guide: Test Types, Harnesses, and Conventions

Adopted for `packages/app-core` (see `docs/conventions/frontend-architecture-guide.md` and
`docs/architecture/v1-architecture-decisions.md`). Its assumed stack — Vitest, Playwright Component
Testing, Testing Library, axe-core — sits on this project's actual Vite + React +
React Router + TanStack Query core with no adaptation needed. Two changes from the
source doc, both applied throughout below: `TestContext` is typed generically over
the simulator type rather than `any`, so simulator-aware page objects keep full type
safety; and `window.testHooks` installation is a **hard requirement** to gate behind a
real build flag, not a suggestion to skip under time pressure. See "This project's
two-shell scope" at the end for how IWFT/E2E boundaries map across the extension and
the web app, and what this guide deliberately doesn't cover.

Apply these conventions when writing or reviewing frontend tests. They produce a suite
that is fast, non-flaky, and that fails with a readable trace rather than a timeout.

---

## Part 1 — The four test types, and how to choose

| Type | Extension | Runner | Backend | What it's for |
|---|---|---|---|---|
| **Unit** | `.test.ts(x)` | Vitest + jsdom | none | Pure functions, query/mutation options, hook internals |
| **IWFT** | `.iwft.ts(x)` | Playwright CT | simulated, in-browser | **Default for all UI behaviour** |
| **Screenshot** | `.screenshot.ts` | Playwright CT | simulated | Visual regression + accessibility |
| **E2E** | `.e2e.ts` | Playwright | real stack | Frontend↔backend integration only |

**IWFT** ("Isolated Whole-Frontend Test") means: mount the *entire* app in a real
browser, with every network call intercepted by an in-process simulated backend. Real
routing, real rendering, real event loop — but deterministic data and no server.

### The choice rule, in priority order

1. **Default to an IWFT.** It exercises real browser behaviour, doesn't couple to
   implementation details, and data setup is trivial. Most UI behaviour belongs here.
2. **Reach for a unit test** only for things awkward to exercise in a browser: a pure
   function's edge cases, a cache-invalidation rule, an exact log call, a hook's
   internal bookkeeping.
3. **Reach for E2E** only when the assertion is genuinely about FE↔BE integration —
   data actually persisting, auth actually working, a real contract being honoured.
   E2E is the slowest and flakiest tier; keep it to a handful of scenarios per feature.
4. **Never write both** an IWFT and a unit test for the same behaviour. If you catch
   yourself doing it, delete the unit test.

**Anti-pattern:** reaching for Testing Library because it's familiar. A jsdom render
test that asserts on component internals is the most expensive kind of test to own —
it breaks on refactors and catches nothing a browser test wouldn't.

### File naming and layout

```
src/
  features/<feature>/
    util/orderBy.ts / orderBy.test.ts           # unit, colocated
    types/ItemFactory.testHelper.ts             # test data factory
    types/ItemTestConstants.testHelper.ts       # shared literals
    components/<page>/<Page>TestIds.ts          # test id constants
  playwright/
    iwft/
      scenarios/*.iwft.ts                       # the tests
      support/                                  # fixture, launcher, display config
      network/                                  # backend simulator + route handlers
    e2e/
      scenarios/*.e2e.ts
      support/                                  # fixture, launcher, test-helper API
    screenshots/
      *.screenshot.ts
      snapshots/                                # committed PNGs
    pageObjects/<area>/*PageObject.testHelper.ts  # SHARED by iwft + e2e + screenshot
```

**Rules**
- Every shared test module ends `.testHelper.ts`. Lint must forbid production code
  importing from a `.testHelper` file — this is the single guard that stops test
  fixtures leaking into the bundle.
- **Page objects are shared across all three browser tiers.** This is the highest-value
  structural decision in the whole setup: one `TasksPageObject` serves IWFT, screenshot,
  and E2E, so a selector change is a one-line fix everywhere.
- Screenshot snapshots live under one `snapshotDir` in the repo, committed.

---

## Part 2 — Test IDs

Query by a dedicated test attribute, not by CSS class, DOM structure, or fragile text.

```ts
// TasksPageTestIds.ts — sibling to TasksPage.tsx
export const tasksPageTestIds = {
  root: 'TasksPage.root',
  loader: 'TasksPage.loader',
  activeSection: 'TasksPage.activeSection',
  completedSection: 'TasksPage.completedSection',
}
```

**Rules**
- One `<Component>TestIds.ts` per component, exporting a single `camelCase` object.
  Never inline a test-id string in a component or a test.
- Values are namespaced `'<Component>.<element>'`. Collisions become obvious, and a
  failure message names the component.
- Every page/major component exposes a `root`. Page objects assert on it in
  `verifyIsShown()`.
- Configure the attribute once, in three places that must agree:

```ts
// playwright configs
use: { testIdAttribute: DATA_TEST_ATTRIBUTE }
// vitest setup
reactTestingLibraryConfigure({ testIdAttribute: DATA_TEST_ATTRIBUTE })
```

- Prefer a test id over `getByRole`/`getByText` for *locating*. Use role and text
  assertions for what they're uniquely good at — verifying the accessible name or the
  user-visible copy is correct.

---

## Part 3 — Page objects

All browser-tier tests drive the app exclusively through page objects. A test should
read as a user narrative with no Playwright API in sight.

### 3.1 A shared abstract base

`TestContext` is generic over the simulator type (`TestContext<TSimulator =
BackendSimulator>`), not `backendSimulator?: any` — that's the one change from the
source of this guide worth calling out explicitly: a loosely-typed simulator field
quietly removes type safety from every simulator-aware page object that touches it.

```ts
export abstract class PageObject {
  protected readonly name: string

  constructor(
    readonly testContext: TestContext,
    protected readonly locator?: Locator,   // set when scoped to part of the DOM
  ) {
    const constructorName = this.constructor.name
    if (!constructorName.endsWith('PageObject')) {
      throw new Error(`Expected constructor name to end with 'PageObject', but got: ${constructorName}`)
    }
    this.name = removeSuffix(constructorName, 'PageObject')
  }

  get page() { return this.testContext.page }

  // Every action is a named trace step, auto-prefixed: "TasksPage.clickShowAll"
  protected step = <T>(name: string, body: () => T | Promise<T>): Promise<T> =>
    test.step(`${this.name}.${name}`, body)

  protected get = (testId: TestId): Locator => this.locatorOrPage().getByTestId(testId)
  protected locatorOrPage = (): Locator | Page => this.locator ?? this.page

  protected click = (target: TestId | Locator) => this.resolveLocator(target).click()
  protected expectToBeVisible = (testId: TestId) => expect(this.get(testId)).toBeVisible()
  protected expectNotToBeVisible = (testId: TestId) => expect(this.get(testId)).not.toBeVisible()
  protected expectToHaveCount = (testId: TestId, count: number) =>
    expect(this.get(testId)).toHaveCount(count)

  verifyIsAccessible = (disabledRules: string[] = []): Promise<void> =>
    this.step('verifyIsAccessible', () =>
      expect(async () => {
        const results = await new AxeBuilder({ page: this.page })
          .options({ preload: false })
          // Modern browsers scroll overflow containers without focusable children.
          .disableRules(['scrollable-region-focusable', ...disabledRules])
          .analyze()
        expect(results.violations).toEqual([])
      }).toPass(),
    )
}
```

**Rules**
- **Wrap every public method in `this.step(...)`.** The payoff is the failure trace:
  a CI failure reads as a labelled list of user actions, not a stack of anonymous
  locator calls. This is the difference between debugging a flake in two minutes and
  in an hour.
- The constructor-name assertion is worth the three lines — it keeps the derived
  `name` (and therefore every trace label) honest.
- Take an optional `locator` so the same class can be scoped to one card in a list
  (`new ItemPageObject(ctx, this.get(itemCardTestIds.container))`).
- Pass a `TestContext` (`{ page, frame?, backendSimulator? }`), not a bare `Page`, so
  iframe-scoped and simulator-aware page objects work without a second hierarchy.

### 3.2 Concrete page objects

```ts
export class TasksPageObject extends QuickAddCapablePageObject {
  // Shared chrome exposed as getters, constructed lazily.
  get topNavBar(): TopNavBarPageObject { return new TopNavBarPageObject(this.testContext) }

  verifyIsShown = (): Promise<TasksPageObject> =>
    this.step('verifyIsShown', async () => {
      await this.expectToBeVisible(tasksPageTestIds.root)
      return this
    })

  verifyEmptyState = () => this.step('verifyEmptyState', () => this.expectToBeVisible(emptyStateTestIds.root))

  expectTaskCountToBe = (count: number) =>
    this.step(`expectTaskCountToBe ${count}`, () => this.expectToHaveCount(taskCardTestIds.container, count))

  // Returns a CHILD page object scoped to that element.
  expectSingleTask = (): Promise<TaskPageObject> =>
    this.step('expectSingleTask', async () => {
      await this.expectTaskCountToBe(1)
      return new TaskPageObject(this.testContext, this.get(taskCardTestIds.container))
    })

  // Navigation returns the NEXT page object, already verified.
  clickOnlyTask = (): Promise<TaskEditPageObject> =>
    this.step('clickOnlyTask', async () => {
      const taskCard = await this.expectSingleTask()
      return await taskCard.clickBody()
    })
}
```

**Rules**
- **Any method that navigates returns the next page object, already verified.** Tests
  then chain naturally and can never assert against a page that hasn't rendered:
  `const editPage = await tasksPage.clickOnlyTask()`.
- `verifyIsShown()` returns `this` (typed as the concrete class) so launchers can
  `return new XPageObject(ctx).verifyIsShown()`.
- Scope counts to a section rather than the whole page when the page has several lists
  (`page.getByTestId(section).getByTestId(card)`), otherwise a test passes for the
  wrong reason.
- Put cross-cutting behaviour in an intermediate base (`QuickAddCapablePageObject`)
  rather than duplicating it across every page that has the feature.
- Page objects contain **no test data and no assertions about business rules** — they
  expose capabilities; the test decides what's correct.

---

## Part 4 — IWFT: the simulated backend

### 4.1 Structure

```
network/
  BackendSimulator.testHelper.ts        # public API the tests use
  BackendSimulatorDb.testHelper.ts      # in-memory state + handler registry
  Endpoint.testHelper.ts                # EndpointKey enum
  EndpointBehaviourManager.testHelper.ts
  routeHandlers/<Domain>RouteHandler.testHelper.ts
```

### 4.2 Name every endpoint in an enum

```ts
export enum EndpointKey {
  GET_ITEMS = 'GET_ITEMS',
  SAVE_ITEM = 'SAVE_ITEM',
  PATCH_ITEM = 'PATCH_ITEM',
  DELETE_ITEM = 'DELETE_ITEM',
}
```

This is what lets a test say *which* call should fail, rather than stubbing a URL
pattern. It also gives you call counting for free.

### 4.3 Behaviour injection: DEFAULT / ERROR / STALL

```ts
export class EndpointBehaviourManager {
  private readonly behaviours = new Map<EndpointKey, EndpointBehaviour>()

  constructor() {
    for (const key of Object.values(EndpointKey)) { this.behaviours.set(key, EndpointBehaviour.DEFAULT) }
  }

  setBehaviour = (endpoint: EndpointKey, behaviour: EndpointBehaviour): void => { … }
  getBehaviour = (endpoint: EndpointKey): EndpointBehaviour => { /* throw on unknown */ }
}
```

**`STALL` is the important one.** A stalled endpoint is how you test a loading state
deterministically — no arbitrary timing, no race. Without it, loading-state tests are
the flakiest tests in any suite.

### 4.4 A domain-namespaced public API

```ts
export class BackendSimulator {
  private readonly db = new BackendSimulatorDb()

  handleNetworking = async (page: Page): Promise<void> => { /* register all route handlers */ }

  simulateEndpointError   = (endpoint: EndpointKey) => this.db.behaviours.set(endpoint, ERROR)
  simulateEndpointStalled = (endpoint: EndpointKey) => this.db.behaviours.set(endpoint, STALL)
  simulateEndpointDefault = (endpoint: EndpointKey) => this.db.behaviours.set(endpoint, DEFAULT)
  getCallCount = (endpoint: EndpointKey): number => this.db.getCallCount(endpoint)

  // Seeding and inspection, grouped per domain:
  items = {
    addItem:  (item: Item) => this.db.items.addItem(item),
    addItems: (items: Item[]) => items.forEach((item) => this.db.items.addItem(item)),
    getAll:   (): readonly Item[] => this.db.itemList,
    getOnly:  (): Item => getOnlyElement(this.db.itemList),
  }

  // Assert against state the server WOULD have, retried until it settles:
  verifyOnlyItem = (check: (item: Item) => void): Promise<void> =>
    expect(() => check(getOnlyElement(this.db.itemList))).toPass()

  verifyAnalyticsEmitted = (check: (analytics: Analytics) => void): Promise<void> => …
}
```

**Rules**
- Group seeding per domain (`backendSimulator.items.addItems([...])`) — a flat method
  list becomes unnavigable by about the tenth entity.
- `getOnly()` / `verifyOnly...` that **throw when there isn't exactly one** beat
  `[0]`, which silently passes against the wrong record.
- Wrap server-state assertions in `expect(...).toPass()` so they retry — the write is
  in flight when the UI has already updated optimistically.
- Expose analytics verification through the simulator too. Analytics regressions are
  invisible otherwise, and they are business-critical.
- Capture app log records through the simulator and attach them to the test report
  via an `auto: true` fixture. A CI failure then carries the app's own logs.

---

## Part 5 — Fixtures and launchers

### 5.1 One fixture module per tier

```ts
export const test = base.extend<Options & Fixture>({
  displayConfig: [STANDARD_LIGHT, { option: true }],
  backendSimulator: ({}, use) => use(new BackendSimulator()),
  launcher: ({ backendSimulator, mount, page, displayConfig }, use) =>
    use(new Launcher(mount, page, backendSimulator, displayConfig)),

  // Convenience: the common starting page, pre-launched and verified.
  itemsPage: async ({ launcher }, use) => { await use(await launcher.launchExpectingItemsPage()) },

  // auto fixture: always attach app logs to the report afterwards
  annotateTestWithLogs: [
    async ({ backendSimulator }, use, testInfo) => {
      await use()
      addLogRecordToTestReport(backendSimulator.getDb().logRecords, testInfo)
    },
    { auto: true },
  ],
})
```

Tests then import `test` from the fixture module — **never from `@playwright/test`
directly.** That import is the seam the whole harness hangs off.

### 5.2 A launcher per landing page

```ts
interface LaunchOptions {
  shouldDisableAnimations?: boolean
  userId?: UserId
  initialRoute?: string
  featureToggles?: FeatureToggle[]
  featureFlags?: Record<FeatureFlagName, boolean>
  // …any persisted client state the test needs seeded
}

export class Launcher {
  launch                     = (o: LaunchOptions = {}): Promise<HomePageObject> => …
  launchExpectingItemsPage   = (o: LaunchOptions = {}): Promise<ItemsPageObject> => …
  launchExpectingOnboarding  = (o: LaunchOptions = {}): Promise<OnboardingPageObject> => …
  launchExpectingErrorPage   = (o: LaunchOptions = {}): Promise<ErrorPageObject> => …
  launchExpectingNotFound    = (o: LaunchOptions = {}): Promise<NotFoundPageObject> => …
}
```

Each delegates to a `test.step`-wrapped function that mounts and verifies:

```ts
export const launchAppExpectingItemsPage = (testArgs: TestArgs): Promise<ItemsPageObject> =>
  test.step('launchAppExpectingItemsPage', async () => {
    const testContext = await launchAppSignedIn({ ...testArgs, initialRoute: testArgs.initialRoute ?? Routes.items })
    return new ItemsPageObject(testContext).verifyIsShown()
  })
```

**Rules**
- One named launcher per *expected outcome*, including the failure outcomes
  (access-denied, error page, not-found). A test that wants the error page shouldn't
  have to know how to provoke it.
- Everything a test might vary goes in one `LaunchOptions` object — never positional
  args, never a second launcher overload.
- The launcher owns all environment setup in a fixed order: disable animations → set
  session cookies → seed persisted client state → seed feature toggles → set viewport
  → **install network interception** → mount → apply runtime feature flags.
- Network interception must be registered **before** mount, or the app's first
  requests escape the simulator.
- `initialRoute` comes from the typed route factory, never a string literal.

### 5.3 Freeze the clock, always

```ts
await page.clock.setFixedTime(CURRENT_TIME)
await page.clock.install({ time: CURRENT_TIME })
```

Do this for every browser test, not just the ones that render dates. Relative dates
("in 3 days"), timers, and debounces are all sources of midnight-only CI failures.
Pin locale and timezone in the Playwright config too (`locale: 'en-GB'`,
`timezoneId: 'Europe/London'`) — date formatting differs per runner otherwise.

---

## Part 6 — `window.testHooks`: the deliberate escape hatch

A small, explicitly-typed object the app installs in dev/test builds, giving tests
control over things that have no DOM surface.

```ts
export interface TestHooks {
  triggerRenderError: () => void                                  // exercise error boundaries
  setFeatureFlags: (flags: Record<FeatureFlagName, boolean>) => void
  writesSettled: () => number                                     // count of settled mutations
  setQueryLayerOnline: (online: boolean) => void                  // simulate offline
}

export class AppTestHooks implements TestHooks {
  private settledWrites = 0

  watchWrites = (): (() => void) =>
    this.queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && (event.action.type === 'success' || event.action.type === 'error')) {
        this.settledWrites += 1
      }
    })

  writesSettled = (): number => this.settledWrites
  setQueryLayerOnline = (online: boolean) => onlineManager.setOnline(online)
}
```

Installed from a hook, and torn down on unmount:

```ts
useEffect(() => {
  const testHooks = new AppTestHooks(toggleThrowError, overrideFeatureFlags, queryClient)
  const stopWatchingWrites = testHooks.watchWrites()
  window.testHooks = testHooks
  return () => { stopWatchingWrites(); delete window.testHooks }
}, [toggleThrowError])
```

### The payoff: `waitForWriteToComplete`

```ts
waitForWriteToComplete = <T>(action: () => Promise<T>): Promise<T> =>
  this.step('waitForWriteToComplete', async () => {
    const settledWrites = () => this.page.evaluate(() => window.testHooks?.writesSettled() ?? 0)
    const before = await settledWrites()
    const result = await action()
    await expect.poll(settledWrites).toBeGreaterThan(before)
    return result
  })
```

**This is the single most valuable pattern here.** With optimistic updates, the UI
settles *before* the network does — so "assert the text changed, then reload" races the
write and fails a few percent of the time. Counting settled mutations turns that into a
deterministic wait, and it replaces every `waitForTimeout` you'd otherwise be tempted by.

```ts
await editPage.waitForWriteToComplete(() => editPage.setNotes(NOTES))
```

**Rules**
- Keep the interface **tiny and typed**, declared in `global.d.ts`. It is production
  code; treat it as API surface, not a dumping ground.
- Only things with genuinely no DOM surface qualify: mutation settling, forcing the
  query layer offline, triggering a render error, overriding flags at runtime.
- Anything a user can do must be driven through the UI instead.
- **Installation must be gated behind a real build flag** — not left as a convention
  that's easy to skip under time pressure. `window.testHooks` is production code that
  ships if this isn't enforced; treat the gate itself as a requirement, not an
  optional nicety.

---

## Part 7 — Screenshot tests

### 7.1 A display-config matrix

```ts
export interface DisplayConfig { screenSize: ScreenSize; displayMode: DisplayMode }

export enum ScreenSize { STANDARD, STANDARD_TALL, MOBILE, MOBILE_TALL, MOBILE_LANDSCAPE }
export enum DisplayMode { LIGHT, DARK }

export const DEFAULT_SCREENSHOT_DISPLAY_CONFIGS = [STANDARD_LIGHT, MOBILE_LIGHT]

export const displayConfigName = (config: DisplayConfig) =>
  `${config.screenSize}-${config.displayMode}`.toLowerCase().replaceAll('_', '-')
```

### 7.2 One helper that fans a test across configs

```ts
export const screenshotTest = (
  name: string,
  testBody: AppTestBody,
  displayConfigs: DisplayConfig[] = DEFAULT_SCREENSHOT_DISPLAY_CONFIGS,
) => {
  for (const displayConfig of displayConfigs) {
    test.describe(name, () => {
      test.use({ displayConfig })
      test(displayConfigName(displayConfig), testBody)
    })
  }
}
```

Usage — note the config matrix is opt-in per test, so a landscape-specific case costs
one extra argument, not a duplicated test:

```ts
screenshotTest(
  'Items page',
  async ({ backendSimulator, launcher, displayConfig }) => {
    setUpItems(backendSimulator)
    const itemsPage = await launcher.launchExpectingItemsPage()
    await itemsPage.verifyScreenshot('items-page', displayConfig, {
      scopeToTestId: layoutTestIds.container,
    })
  },
  [...DEFAULT_SCREENSHOT_DISPLAY_CONFIGS, MOBILE_LANDSCAPE_LIGHT],
)
```

### 7.3 `verifyScreenshot` does the stabilising *and* the a11y scan

```ts
verifyScreenshot = (name, displayConfig, {
  maintainHover = false, maintainFocus = false, maskTestId, scopeToTestId,
  disabledAxeRules, maxDiffPixelRatio, animations,
} = {}) =>
  this.step(`verifyScreenshot ${name}`, async () => {
    await waitForFontsToLoad(this.page)
    await this.removeFocusAndHoverIfNecessary({ removeHover: !maintainHover, removeFocus: !maintainFocus })

    await expect(this.screenshotTarget(scopeToTestId)).toHaveScreenshot(
      validScreenshotFileName(`${name}-${displayConfigName(displayConfig)}.png`),
      { mask: maskTestId ? [this.get(maskTestId)] : [], maxDiffPixelRatio, animations },
    )

    await this.resumeTimers()
    await this.verifyIsAccessible(disabledAxeRules)   // every screenshot is also an axe scan
  })
```

**Rules**
- **Bundle the accessibility scan into the screenshot assertion.** You get axe coverage
  across every visual state for free, at every viewport, with no separate test tier —
  this is the cheapest accessibility coverage available.
- **Scope to a component** (`scopeToTestId`), not the full page, unless the layout
  itself is under test. Full-page shots churn on every unrelated change.
- Stabilise before capturing: wait for fonts, clear hover and focus (opt back in
  explicitly when the hover/focus state *is* the subject), mask anything genuinely
  non-deterministic.
- Run screenshots on **one platform only** (a Linux container). Font rendering differs
  per OS; skip with a log line elsewhere rather than producing false diffs.
- Pin a `threshold` (~0.02) and a shared `stylePath` that neutralises animations and
  carets.
- Give snapshots a stable, descriptive name per state: `items-page-empty`,
  `items-page-loading`, `items-page-error`. Capture the **loading and error states** —
  they're the ones that regress unnoticed.

---

## Part 8 — E2E tests

Keep E2E deliberately thin: a handful of persistence and auth scenarios per feature.

### 8.1 Seed data through a backend test-helper endpoint, never through the UI

```ts
export class TestHelper {
  createUserWithData = (request: CreateUserWithDataRequest): Promise<CreateUserWithDataResponse> =>
    this.step('createUserWithData', async () => assertSuccessResult(await this.api.createUserWithData(request)))
}
```

A dedicated backend test-helper service that creates a user plus their data in one call
is worth building early. Driving setup through the UI makes every E2E test slow *and*
couples it to unrelated screens.

### 8.2 The shape of an E2E test

```ts
test('edits to an item are still there after reloading', async ({ launcher, testHelper }) => {
  const user = await testHelper.createUserWithData({ items: [{ summary: DEFAULT_SUMMARY }] })
  const itemsPage = await launcher.launchItems(user.email)

  const editPage = await itemsPage.clickOnlyItem()
  await editPage.waitForWriteToComplete(() => editPage.setNotes(DEFAULT_NOTES))

  const reloaded = await launcher.goToItems()          // real reload — the actual assertion
  const card = await reloaded.expectSingleItem()
  const reloadedEditPage = await card.clickBody()
  await reloadedEditPage.verifyNotes(DEFAULT_NOTES)
})
```

**Rules**
- Every E2E test creates **its own user**. Shared fixture users make tests
  order-dependent and unparallelisable.
- The assertion must be something an IWFT genuinely cannot make — in practice: *it
  survived a reload*, *auth worked*, *the contract matched*.
- Reuse the same page objects as the IWFTs. The E2E launcher differs (real `goto` and a
  real session) but nothing below it should.
- `waitForWriteToComplete` matters even more here; there's a real network involved.

---

## Part 9 — Unit tests

### 9.1 Setup

```ts
reactTestingLibraryConfigure({ testIdAttribute: DATA_TEST_ATTRIBUTE })

beforeEach(() => {
  expect.hasAssertions()   // fails any test that asserts nothing
})
```

Plus `mockReset: true` in the Vitest config. `expect.hasAssertions()` catches the
classic silent pass — an async test whose assertions never ran.

### 9.2 Pure functions: factories in, exact value out

```ts
describe('orderItemsByCompletion', () => {
  it('moves completed items below incomplete ones', () => {
    const completed = makeItem({ status: Status.COMPLETED })
    const pending = makeItem({ status: Status.PENDING })

    expect(orderItemsByCompletion([completed, pending])).toEqual([pending, completed])
  })

  it('returns an empty list unchanged', () => {
    expect(orderItemsByCompletion([])).toEqual([])
  })
})
```

- One behaviour per `it`, named as a sentence about behaviour, not about the function.
- Cover order-preservation and empty-input cases explicitly; they're where sort
  implementations actually break.

### 9.3 Hooks and query/mutation options

Because the API is injected as a defaulted parameter, no module mocking is needed:

```ts
const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const renderPatchMutation = (queryClient: QueryClient, axiosMocker: AxiosMocker) => {
  const api: ItemApi = new HttpItemApi(axiosMocker.getHttpClient())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => usePatchItemMutation(api), { wrapper }).result
}
```

Reserve these for cache mechanics an IWFT can't observe — that a rollback restored the
exact prior value, that an unrelated cache key was left alone, that invalidation fired
once rather than per-mutation.

### 9.4 Factories and shared constants

```ts
// ItemFactory.testHelper.ts
export const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: ItemId.random(),
  summary: DEFAULT_ITEM_SUMMARY,
  status: Status.PENDING,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

// ItemTestConstants.testHelper.ts
export const DEFAULT_ITEM_SUMMARY = 'Item Summary'
export const DEFAULT_ITEM_NOTES = 'Item Notes'
```

**Rules**
- Every domain type gets a `make<Type>(overrides)` factory. Never build an entity
  literal inline in a test.
- Valid, complete defaults; **`overrides` spread last**.
- Random ids by default so tests can't accidentally depend on a fixed one — but let a
  test pass an explicit id when it needs to assert on it.
- Shared string literals live in a `TestConstants.testHelper.ts` so an E2E test and an
  IWFT can assert on the same value.
- Factories are readable data: `makeItem({ status: Status.COMPLETED })` says what the
  test is about. Avoid terse names in test data as much as in production code.

---

## Part 10 — Configuration and anti-flake rules

### 10.1 Config essentials

```ts
{
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // a stray .only can't pass CI
  retries: process.env.CI ? 1 : 0,       // 0 locally: never hide a flake from its author
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },   // shorter locally = faster feedback
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: DATA_TEST_ATTRIBUTE,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  },
  reporter: [
    ['list', { printSteps: !!process.env.CI }],   // step names in CI logs — see Part 3
    ['json', { outputFile: 'test-results/test-results.json' }],
    // + blob reporter when sharding, + a flake-tracking reporter if you have one
  ],
}
```

Drive IWFT and screenshot runs off **one component-test config** switched by an env
var (`testDir` and `testMatch` toggle between `iwft/` and `screenshots/`) — they share
the entire harness, and duplicating the config guarantees the two drift.

### 10.2 Anti-flake rules

- **Never `waitForTimeout`.** Use `expect.poll` for a changing value, `toPass()` for a
  retried assertion block, `STALL` behaviour for loading states, and
  `waitForWriteToComplete` for in-flight writes.
- **Freeze the clock in every browser test.**
- **Every test seeds its own data.** No shared mutable fixtures, no inter-test ordering.
- **Assert on a settled state, not on a transition** — unless the transition is the
  subject, in which case stall the endpoint to hold it still.
- **`retries: 0` locally.** A flake must fail for the person who wrote it.
- Retain trace *and* video on failure. The trace alone often doesn't show a timing bug.
- Track flake rates over time if you can; a suite without that measurement decays.

---

## Part 11 — Review checklist

**Tier choice**
- [ ] UI behaviour is covered by an IWFT, not a jsdom render test.
- [ ] No behaviour covered by both an IWFT and a unit test.
- [ ] E2E tests assert something only a real backend can prove.

**Structure**
- [ ] Test locates by test-id constants from a `<Component>TestIds.ts`; no inline strings.
- [ ] Test drives the app only through page objects; no raw locators in the test body.
- [ ] Every page-object method is `step`-wrapped and navigation returns the next, verified page object.
- [ ] Page objects are shared across IWFT / screenshot / E2E.
- [ ] `test` is imported from the fixture module, not from `@playwright/test`.
- [ ] Entities built via `make<Type>(overrides)`; no inline entity literals.
- [ ] Shared test modules end `.testHelper.ts`; production code never imports them.

**Determinism**
- [ ] Clock frozen; locale and timezone pinned.
- [ ] No `waitForTimeout` anywhere.
- [ ] Loading states tested via a stalled endpoint, not by racing.
- [ ] Post-write assertions go through `waitForWriteToComplete`.
- [ ] Test seeds its own data and its own user.

**Coverage**
- [ ] Error and empty states covered, not just the happy path.
- [ ] Screenshot states include loading and error.
- [ ] Screenshots scoped to the component under test.
- [ ] Analytics assertions where an event is business-critical.
- [ ] Accessibility scanned (free, via `verifyScreenshot`).

---

## This project's two-shell scope

This guide assumes one app. This project has one shared `packages/app-core` plus two
thin shells (the Chrome extension, the web app) — see
`docs/architecture/v1-architecture-decisions.md`. That changes where the tiers above actually apply:

- **IWFT scope is `app-core` only.** Mount it once, simulate the Fastify API, and get
  full route/render/interaction coverage there — not duplicated per shell. Since both
  shells mount the same core verbatim, testing it once covers both.
- **The extension's chrome.*-API surface needs its own harness, not this one.**
  Content-script injection (the digest button injected into a YouTube page),
  auto-grabbing the transcript when a YouTube tab opens, and side-panel-specific
  behaviour all live outside `app-core` — none of it is exercised by IWFT or E2E as
  defined here, because none of it talks to our backend or renders through the shared
  router. Playwright's extension-testing mode is the natural fit for that surface, but
  the harness itself is a separate, not-yet-designed piece of work.
- **E2E runs once, against the web shell.** The thing being proven — sign in, write,
  survives a reload — is a property of the Fastify API and `app-core`'s data layer,
  not of which shell is hosting them. Running it again against the extension shell
  would prove the same contract twice for the cost of maintaining two E2E launchers.
- **Backend testing is entirely out of scope for this guide.** It's frontend-only, by
  its own stated stack. Testing conventions for the Fastify API and the Python TTS
  service are a separate, parked decision — alongside product naming, see
  `docs/architecture/v1-architecture-decisions.md`.

## Notes on what I'd change rather than copy wholesale

- **`TestContext` was loosely typed in the source** (`backendSimulator?: any`), which
  quietly removes type safety from every simulator-aware page object. Type it generic
  over the simulator type instead — applied throughout this doc already.
- **The `testHooks` interface is production code.** It's worth being stricter than the
  source is about build-flag gating it — the source doc says to gate it, but frames it
  as conditional ("if the hooks must not ship"); here it's a hard requirement, since
  it's the rule most likely to get skipped under time pressure.
