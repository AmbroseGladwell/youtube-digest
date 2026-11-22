import { usePageScrolled } from "../../../util/usePageScrolled.js";
import styles from "./PageScrolledSentinel.module.scss";

// Goes at the top of a page whose sticky chrome sits over content
// (docs/features/fade-under-the-bar.md).
export const PageScrolledSentinel = () => {
  return <div className={styles.root} ref={usePageScrolled()} aria-hidden="true" />;
};
