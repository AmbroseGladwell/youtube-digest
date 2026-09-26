# File and folder naming

**Core rule: a file is named after its primary export, in that export's own casing.**
PascalCase for a class, interface, type, or React component; camelCase for a file whose
exports are functions or plain values. Never `snake_case` in TypeScript or Kotlin.

```
Task.ts                        export interface Task
TaskCard.tsx                   export const TaskCard
HttpTaskApi → taskApi.ts       exports a class AND an instance — name for the instance
taskKeys.ts                    export const taskKeys
tasksQuery.ts                  export const tasksQueryOptions
orderItemsByCompletion.ts      a function
```

When a file exports both a type and a function, name it for whichever the file exists
to provide — an `api/` file exports the instance, so it's camelCase even though it also
declares an interface and a class.

## By folder role

| Folder | Casing | Examples |
| --- | --- | --- |
| `types/` | **Pascal** | `Task.ts`, `GetTasksResponse.ts` |
| component folders | **Pascal** | `TaskEditPage.tsx`, `IntentionsList.tsx` |
| `api/` | camel | `taskApi.ts`, `profileApi.ts` |
| `queries/` | camel | `tasksQuery.ts`, `deadlinesQuery.ts` |
| `mutations/` | camel | `patchTaskMutation.ts` |
| `util/` | camel | `orderItemsByCompletion.ts`, `viewTransitions.ts` |
| key factories | camel | `taskKeys.ts` |
| hooks | camel | `useTaskEditForm.ts`, `useIsHome.ts` |
| services | follows the export | `analytics.ts` (value) vs `SlidesMerger.ts` (class) |

## Folders

- **A component's own folder is PascalCase and matches the component**: `Pane/Pane.tsx`,
  `CardShell/CardShell.tsx`. It holds `Foo.tsx`, `Foo.module.scss`, `FooTestIds.ts`,
  `Foo.test.ts`, and component-scoped hooks — and no nested subdirectories. Each
  component gets its own sibling folder.
- **Grouping and role folders are camelCase**: `features/`, `queries/`, `mutations/`,
  `pageObjects/`, `features/tasks/`, `components/shared/debug/`.

Some older component folders use camelCase (`tasksPage/`, `deleteTaskButton/`). These
are legacy — **do not copy them**. New component folders are PascalCase.

## Suffixed files

These are named after their **subject**, not their export, so they sort beside the
thing they serve:

| Pattern | Casing | Example |
| --- | --- | --- |
| `<Component>TestIds.ts` | Pascal | `TasksPageTestIds.ts` exports `tasksPageTestIds` |
| `<Type>Factory.testHelper.ts` | Pascal | `TaskFactory.testHelper.ts` exports `makeTask` |
| `<Type>TestConstants.testHelper.ts` | Pascal | `TaskTestConstants.testHelper.ts` |
| `<X>PageObject.testHelper.ts` | Pascal | `TasksPageObject.testHelper.ts` |
| `*.test.ts` / `*.iwft.ts` / `*.e2e.ts` / `*.screenshot.ts` | follows subject | `tasksQuery.test.ts`, `tasks.iwft.ts` |

## SCSS

- `Foo.module.scss` — PascalCase, matching its component.
- `fooTransitions.scss` — camelCase for a non-module stylesheet not tied to one
  component.
- `_foo.scss` — leading underscore for Sass partials.
- Class names inside any of these are `camelCase`.

## Backend and infrastructure

- **Kotlin**: PascalCase matching the class. Function-only files are camelCase
  (`hmacUtils.kt`, `responses.kt`) — the same primary-export rule. *Not applicable to
  this repo today — there is no JVM service in `docs/architecture/v1-architecture-decisions.md`'s
  stack. Kept here because it's a standing convention, not because one is planned.*
- **SQL migrations**: `V{4-digit}__{snake_case_description}.sql`. *Flyway's naming
  convention, applied by a small in-repo runner (`apps/api/src/db/runMigrations.ts`)
  rather than by Flyway itself — see `docs/architecture/api.md`.*
- **Python** (`services/tts/`): `snake_case` throughout. This one's real — it's the
  actual TTS service in this project's decided stack.

## Enforcement

There is no `unicorn/filename-case` or `eslint-plugin-check-file` rule wired up yet
for any of this. Without one, drift like the legacy camelCase component folders above
happens quietly and gets copied forward by whoever's editing nearby. Worth adding once
there's a real lint config to add it to.
