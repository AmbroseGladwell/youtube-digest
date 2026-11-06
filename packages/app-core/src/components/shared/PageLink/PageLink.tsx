import type { ComponentProps } from "react";
import { Link } from "react-router";
import { useShouldAnimateNavigation } from "../../../util/viewTransitions.js";

export type PageLinkProps = Omit<ComponentProps<typeof Link>, "viewTransition">;

// Every link that leaves the page for another one, so that the gate answers for all of them
// in one place rather than at each call site (docs/conventions/frontend-architecture-guide.md
// 2.2, docs/features/page-transitions.md). A link that stays on the page — a tag that filters
// the library in place, an anchor down the note — keeps react-router's own Link.
export function PageLink(props: PageLinkProps) {
  const animate = useShouldAnimateNavigation();
  return <Link {...props} viewTransition={animate} />;
}
