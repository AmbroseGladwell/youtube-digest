import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";

// What a shell renders in place of the app once another context has upgraded the database
// underneath it: the connection closed itself so that upgrade could proceed, so every
// store call from here on would throw. It replaces the whole tree rather than sitting
// inside the shell, because there is no working app left to sit in — and it offers only a
// reload, which is the one thing that does fix it (docs/features/error-state.md).
export function OutOfDateTab() {
  return (
    <ErrorState
      title="This tab is out of date"
      body="Another window updated your library. Reload to catch up."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
    />
  );
}
