# Lint and format

Oxlint lints and Oxfmt formats every JavaScript and TypeScript file in the monorepo, from the
root. Both are root dev dependencies pinned in the lock file, so `npm ci` gives CI and the
dev shell the same version, and Nix doesn't carry them.

| | |
|---|---|
| `task lint` | `npm run lint` then `npm run format:check`, what CI's `lint` job runs |
| `task format` | `npm run format`: every JS and TS file rewritten in place |

A PR that is unformatted or has a lint error fails CI. Editors that speak LSP can run both
on save: `oxlint --lsp` and `oxfmt --lsp`, or the Oxc extension, which reads the same two
config files.

## Before every commit

`.githooks/pre-commit` (pointed at by `task install`) runs gitleaks, then Oxlint and
`oxfmt --check` on the staged JS and TS files only, then the changed-lines rules below on the
lines the commit adds, so it takes seconds. A lint error or an unformatted file refuses the
commit; `task format` fixes the second. It lints the files as
they are on disk, so a file staged in part is checked whole. Typecheck and the test suites
stay in CI: they are too slow and too heavy on memory for every commit.

The checks are deterministic on purpose: a correction that keeps coming back becomes a rule
here, not another line of prose in a convention doc (OV-369).

## Why these two, and not Vite+

Vite+ (VoidZero's `vp` CLI, 1.0 on 28 Sep 2026) was looked at first, on OV-253. Its
`vp check` is these same two tools, and that's the only part of it that would add anything
here:

- `vp dev`, `vp build` and `vp test` are Vite 8 and Vitest 5, which the apps already run.
- `vp env` installs its own Node, which cuts across the Nix shell.
- `vp run` caches tasks, which `local-dev.md` deliberately doesn't do.
- 1.0 calls itself "far from feature-complete", and its pricing for companies isn't settled.

Taking Oxlint and Oxfmt directly means a later move to Vite+ is mostly a matter of renaming
scripts. It's worth looking at again once it runs inside a Nix-pinned Node on npm workspaces
and its pricing is clear.

## Format: `.oxfmtrc.json`

Prettier's defaults (double quotes, semicolons, trailing commas), except for a line width of
140. That's the width the code was already written to. At 140, the one-time reformat changed
about 14,000 lines. At 120 it changed 18,000, and at 100 it changed 41,000.

Only JS and TS files are formatted. Markdown, YAML, SCSS and JSON are left alone: the
docs' line breaks are deliberate, and nothing has been decided about the rest.

The reformat commit is listed in `.git-blame-ignore-revs`. GitHub's blame view reads that
file on its own. Locally, run this once:

```
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Lint: `.oxlintrc.json`

Oxlint's `correctness` category with the TypeScript, Unicorn, Oxc, React, import, Vitest
and Node plugins, all as errors.

`no-unused-vars` ignores parameters (handlers often keep a signature they don't read), caught
errors, rest siblings (`const { a, ...rest }` to drop `a`), and names that start with `_`.

On top of `correctness`, these rules are on, each for a pattern the code had already settled on
(OV-369):

| Rule | What it holds |
|---|---|
| `typescript/no-explicit-any` | `unknown` and a check, or a real type, never `any`. |
| `typescript/consistent-type-definitions: interface` | An object shape is an `interface`; a `type` is for unions, nullable shapes and types derived from others. About 99% of the code already did this. |
| `typescript/consistent-type-imports` | A type-only import says `import type`, so it's erased. |
| `eqeqeq`, with `null` ignored | `===` everywhere, except `== null`, which reads as "null or undefined". |
| `curly: all` | Every `if`, `else`, `for` and `while` body is in braces, so Oxfmt always puts it on its own line. Turned on with Oxlint's own fix across about 2,600 sites; that commit is in `.git-blame-ignore-revs`. |
| `no-var` | `let` and `const`, including in the two `public/appearance.js` scripts. |
| `no-param-reassign` | A parameter is never reassigned; destructure into a `let` instead. |
| `no-unused-expressions` (no ternaries, no short circuits), `no-sequences` | A ternary or `&&` produces a value; a side effect is an `if`. |
| `func-style: expression` | A function is a `const` holding an arrow function, never a `function` declaration. A generator, which can't be an arrow, is a `function*` expression. A `const` isn't hoisted, so a module defines a function before anything at its top level calls it. Converted by a script across about 1,950 functions; that commit is in `.git-blame-ignore-revs`. |
| `prefer-arrow-callback` | Callbacks are arrow functions. Components take `ref` as a prop (React 19), not through `forwardRef(function …)`. |
| `import/no-duplicates`, `import/no-cycle` | One import per module, and no cycles. |
| `react/jsx-no-useless-fragment`, allowing expressions | No fragment around a single element. `<>{node}</>` stays allowed, since it's how a component returns a `ReactNode` as an element. |
| `overview/no-side-effect-ternary` | A ternary sets or returns a value; a side effect is an `if`/`else`. Besides a ternary whose value is thrown away, it catches an assignment in a branch, and an arrow whose whole body is a ternary where nothing uses the result: an `on…` handler in JSX, a `forEach` or `useEffect` callback, a `: void` arrow, or one that calls a `set…` state setter. Without types it can't see every case, so it errs towards letting a returned value through. |
| `max-depth: 3` | No block nested more than three deep inside a function. Past that, a guard returns early, a filter replaces a `continue`, or the inner part becomes a function with a name. |
| `max-nested-callbacks: 3` (4 in tests) | No more than three callbacks inside each other. A test's `describe`, `it` and one callback already make three, so tests get a fourth. |
| `no-nested-ternary` | A ternary has one condition. Past that, a union becomes a `Record` lookup, a return becomes `if`/`return` guards, a value becomes a named helper, and JSX becomes a helper or a small component. |
| `overview/no-long-comment` | A comment is one line at most, and never a TODO or FIXME (`commenting.md`). Tool directives such as `@ts-expect-error` and `oxlint-disable` don't count. It ran on changed lines only until OV-377 cleared the 2,507 older ones. |
| `overview/no-inline-object-type` | An object type with two or more members is an `interface` with a name, never written inline in a parameter or return type. A component's props are `<Component>Props`. Off in tests. |

### Stylesheets

Oxlint doesn't read SCSS or CSS, so `scripts/checkStyleComments.mjs` holds the same line there as `no-long-comment` does in TypeScript: no comment of more than one line, and no TODO or FIXME (OV-378). `npm run lint` runs it on every style file, and the pre-commit hook on the staged ones. `prototype/` is left alone, as evidence.

`scripts/checkStyleFontSizes.mjs` refuses a `font-size` or `font` shorthand in `px` with nothing beside it that follows the browser's text size (OV-388): use `rem`, or `max(16px, 1rem)` for a floor. It runs in the same two places. The reason is in `frontend-architecture-guide.md` §4.5.

### Type-aware rules

`npm run lint` and the pre-commit hook pass `--type-aware`, so Oxlint asks `oxlint-tsgolint` (TypeScript's own checker, in Go) for types. That runs the type-aware rules in `correctness`, and the two below. A run over the whole repo takes about 9 seconds and peaks under 1 GB. On a commit's few files it takes under a second. It reads `@overview/*` types from each package's `dist`, so CI's `lint` job builds the packages first, and locally a stale `dist` gives stale answers, just as it does for `task typecheck`.

`oxlint-tsgolint` is TypeScript 7, where `types` defaults to `[]`, so a package that uses Node's globals (`URL`, `Request`) and has no DOM lib names `"types": ["node"]` in its tsconfig. Without it, those types are unknown to the linter, though `tsc` 5.9 would still find them.

| Rule | What it holds |
|---|---|
| `typescript/switch-exhaustiveness-check`, with a `default` counting as exhaustive | A `switch` on a union with no `default` names every member, so adding a member points at every switch that has to handle it. |
| `typescript/no-floating-promises` | A promise is awaited, returned, or explicitly let go with `void`. `node:test`'s `test`, `it`, `describe` and `suite` are allowed, since their promise is the runner's to await. |

In tests, `unbound-method`, `no-base-to-string`, `no-misused-spread`, `no-implied-eval` and `require-array-sort-compare` are off. Fakes pass methods to spies, stringify a `fetch` input they know is a string, spread `document` into a stub, `eval` the script under test, and sort short lists of strings for an assertion.

### Custom rules: `scripts/oxlint/`

The `overview/…` rules are an Oxlint JS plugin in `scripts/oxlint/overviewPlugin.mjs`, one file
per rule, each with a `RuleTester` test that `task test:tooling` runs. A new house rule goes
there when no built-in rule holds the pattern.

### Rules on the lines a change adds

One rule would fail on many existing lines, so it checks only the lines a change
adds or edits. Nothing gets worse, and older lines are cleaned up in batches of their own.
`.oxlintrc.changed-lines.json` holds it, and `scripts/oxlint/lintChangedLines.mjs` keeps only
the problems on new lines. The pre-commit hook checks what's staged. CI and `task lint` check
everything the branch adds since it left `origin/main`. A line moved unchanged within a file
doesn't count as new; editing it does.

| Rule | What it holds |
|---|---|
| `overview/no-repeated-string` | A string written twice in one file is a const at the top of the file. A URL, path, storage key, header or event name (a string with no spaces) that another product file also has is exported once, from the module that owns it. Copy shared between screens isn't: two screens that say "Try again" may change apart. Off in tests, where repeating a fixture reads better. |

`no-repeated-string` leaves out strings that are usually a string union's members rather than
copy: single words like `"video"` or `"in-progress"`, strings compared with `===` or in a
`case`, import paths, object keys, types and JSX attribute values. Across files it only
compares strings of eight characters or more with no spaces in them.

### Import boundaries

`no-restricted-imports` holds the boundaries between workspaces. Each one held already when it went on (OV-369), so these keep the shape rather than change it:

| Where | Refused | Why |
|---|---|---|
| Everywhere | `@overview/<package>/<anything>` | A package is imported by its name. Its only public subpaths are listed in its `package.json` `exports`: `@overview/domain/accentPalette`, and `@overview/transcripts/testing` for tests. |
| Everywhere | a path through `apps/` | Packages are what apps share. A package never reaches into an app, and apps don't import each other. |
| Product code | a `.testHelper` file | Test helpers ship to no one. |
| `packages/domain/src` | any other `@overview/*` package | The domain is the bottom of the graph. |
| `packages/domain/src`, `packages/app-core/src` | `node:*` | Both run in the browser. |

Tests (`*.test.*`, `*.testHelper.*`), `playwright/` and `scripts/` keep only the first two rules: they may use test helpers, `@overview/transcripts/testing` and Node.

A new boundary is a new row here and a pattern in `.oxlintrc.json`. Each pattern's `message` is what the reader sees when they cross it, so it says why.

`tsconfig.base.json` sets `erasableSyntaxOnly`, so `tsc` refuses `enum`, `namespace` and
constructor parameter properties: TypeScript that would produce code rather than just be
erased. Mutually exclusive states are a string union or Zod enum, and a set of named values is
an `as const` object with a type derived from it.

These rules are off in some folders, each with a reason:

| Rule | Where | Why |
|---|---|---|
| `max-depth`, `max-nested-callbacks`, `no-nested-ternary` | `apps/api/src/scripts/chatAcrossSourcesCheck.ts` | A 2,200-line research harness from OV-307, nested well past the limits. Restructuring its main loop could only be proved safe with a paid run, so it stays as it is. New harness code follows the rules. |
| `import/no-cycle` | `**/playwright/**` | Page objects follow the app's navigation: the library opens the reader, and the reader goes back to the library, so each imports the other. The imports are only used inside methods, so the cycle is harmless at load time, and breaking it would mean redesigning how page objects hand over to each other. |

These rules are off, and each one has a reason:

| Rule | Why it's off |
|---|---|
| `typescript/no-unnecessary-condition` | Its 190 hits are mostly guards kept on purpose where the types promise more than the runtime gives: `globalThis.removeEventListener?.()` for the Node tests, `setPointerCapture?.()` for jsdom, `textContent ?? ""`. Following it would delete guards that stop real crashes. |
| `react-hooks/exhaustive-deps` | 22 existing effects leave dependencies out, many of them on purpose. Each one needs reviewing on its own before the rule can go on, since adding a dependency changes when an effect runs. That review is its own card. |
| `react/refs`, `react/set-state-in-effect`, `react/purity`, `react/immutability`, `react/preserve-manual-memoization`, `react/incompatible-library` | These are React Compiler's rules, and the apps don't run the React Compiler. Meeting them would mean restructuring about a hundred components for a compiler we don't use. `incompatible-library` also refuses `@tanstack/react-virtual`, which the library list uses (OV-381). |
| `unicorn/no-thenable` | `then` is a real field in the domain: a recipe step's "then" clause, the second line of a notice's copy. None of them is ever awaited. |
| `unicorn/no-useless-spread` | It flags `[...url.searchParams.keys()]` in `canonicalArticleUrl.ts`, where the copy is what makes deleting while looping safe. Following its advice there would introduce a bug. |
| `unicorn/no-new-array` | `new Array<number>(n).fill(0)` is clear, and it's typed. |
| `vitest/require-mock-type-parameters`, `vitest/require-to-throw-message` | Test style the suites don't follow. Testing a message where it matters is the frontend testing guide's call, not the linter's. |

Turning a rule back on is a PR that fixes every hit and moves its row out of this table.
Never use an inline `oxlint-disable` comment as a way around a rule: either the rule is
wrong for this codebase and goes in this table, or the code changes.
