# React State

For this project's actual state-management decision, see
`docs/conventions/frontend-architecture-guide.md`: no client-state library
until genuinely warranted, `useReducer` plus Context for the rare app-wide
case, TanStack Query for server state. The version of this file originally
brought in recommended Redux for application state and covered class-component
state at length — from a different codebase, on a different stack, and not
what this project does. That's been dropped rather than kept as conflicting
advice.

What's left is genuinely stack-agnostic and still holds:

## Component state

- Prefer several individual `useState` calls over one call holding an object
  with multiple properties.
- Hooks must be called in the same order on every render — never inside an
  `if`, a loop, or after an early return.
- If a value is needed more than roughly two levels down via props, or in an
  unrelated part of the page, that's the signal it belongs in shared state
  rather than a single component's own state — not a reason to reach for a
  specific library by default.

## Persistence

- `localStorage` for state that only needs to survive a refresh on the same
  device.
- A database, reached through a real sync layer, for state that needs to
  follow a user across devices — not a local-storage workaround.
