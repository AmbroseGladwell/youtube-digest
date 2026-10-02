import { useRouteError } from "react-router";
import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";
import { useReportError } from "../features/errors/useReportError.js";

export function RouterErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  useReportError(error, "routeBoundary", { handled: false });

  return (
    <ErrorState screen="routeError"
      title="Something went wrong"
      body="Reloading usually fixes it. Your overviews are unaffected."
      action={{ label: "Reload", onSelect: () => globalThis.location.reload() }}
      back
    />
  );
}
