import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";

export interface StartupFailureProps {
  blocked: boolean;
}

// Why two cases: docs/features/error-state.md, "The two startup failures use it too".
export const StartupFailure = ({ blocked }: StartupFailureProps) => {
  return blocked ? (
    <ErrorState
      screen="libraryLocked"
      title="Another window has your library open"
      body="This app is open in another window on an older version. Close it, then reload."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
    />
  ) : (
    <ErrorState
      screen="libraryUnopenable"
      title="Couldn't open your library"
      body="Something went wrong opening the storage your overviews are kept in."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
    />
  );
};
