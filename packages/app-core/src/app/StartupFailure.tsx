import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";

export interface StartupFailureProps {
  blocked: boolean;
}

// What a shell renders when the local database could not be opened at all, so there are no
// stores to give the app. Two cases, because the reader can act on one of them: a blocked
// open is another window holding an older version, which closing that window fixes, and
// everything else is a storage failure they can only retry (docs/features/error-state.md).
export function StartupFailure({ blocked }: StartupFailureProps) {
  return blocked ? (
    <ErrorState
      title="Another window has your library open"
      body="This app is open in another window on an older version. Close it, then reload."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
    />
  ) : (
    <ErrorState
      title="Couldn't open your library"
      body="Something went wrong opening the storage your overviews are kept in."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
    />
  );
}
