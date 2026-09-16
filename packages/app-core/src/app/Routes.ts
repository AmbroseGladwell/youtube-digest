// The single place that knows every path this app has (docs/conventions/frontend-architecture-guide.md
// 1.2). Only one route exists today — the home page, which shows the plain generate
// form or the library depending on whether the user has any overviews yet — but call
// sites (navigate(), <Link>, tests) should go through this rather than a string literal
// from the start, so adding more routes later doesn't mean hunting down inlined paths.
export const Routes = {
  home: () => "/",
};
