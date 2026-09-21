import { useRouteError } from "react-router";
import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";

export function RouterErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  return (
    <ErrorState
      title="Something went wrong"
      body="Reloading usually fixes it. Your overviews are unaffected."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
      back
    />
  );
}
