import type { ComponentProps } from "react";
import { Link } from "react-router";
import { useShouldAnimateNavigation } from "../../../util/viewTransitions.js";

export type PageLinkProps = Omit<ComponentProps<typeof Link>, "viewTransition">;

// For links that leave the page; one that stays on it, like an anchor down the note, keeps the router's Link.
export const PageLink = (props: PageLinkProps) => {
  const animate = useShouldAnimateNavigation();
  return <Link {...props} viewTransition={animate} />;
};
