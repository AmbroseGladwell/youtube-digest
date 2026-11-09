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
and Node plugins, all as errors. Type-aware linting is off for now.

`no-unused-vars` ignores parameters (handlers often keep a signature they don't read), caught
errors, rest siblings (`const { a, ...rest }` to drop `a`), and names that start with `_`.

These rules are off, and each one has a reason:

| Rule | Why it's off |
|---|---|
| `react-hooks/exhaustive-deps` | 22 existing effects leave dependencies out, many of them on purpose. Each one needs reviewing on its own before the rule can go on, since adding a dependency changes when an effect runs. That review is its own card. |
| `react/refs`, `react/set-state-in-effect`, `react/purity`, `react/immutability`, `react/preserve-manual-memoization` | These are React Compiler's rules, and the apps don't run the React Compiler. Meeting them would mean restructuring about a hundred components for a compiler we don't use. |
| `unicorn/no-thenable` | `then` is a real field in the domain: a recipe step's "then" clause, the second line of a notice's copy. None of them is ever awaited. |
| `unicorn/no-useless-spread` | It flags `[...url.searchParams.keys()]` in `canonicalArticleUrl.ts`, where the copy is what makes deleting while looping safe. Following its advice there would introduce a bug. |
| `unicorn/no-new-array` | `new Array<number>(n).fill(0)` is clear, and it's typed. |
| `vitest/require-mock-type-parameters`, `vitest/require-to-throw-message` | Test style the suites don't follow. Testing a message where it matters is the frontend testing guide's call, not the linter's. |

Turning a rule back on is a PR that fixes every hit and moves its row out of this table.
Never use an inline `oxlint-disable` comment as a way around a rule: either the rule is
wrong for this codebase and goes in this table, or the code changes.
