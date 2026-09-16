import { useRouteError } from "react-router";

export function RouterErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  return (
    <div role="alert" style={{ padding: "2rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1>Something went wrong</h1>
      <p>The page hit an unexpected error. Reloading usually fixes it.</p>
    </div>
  );
}
