import { usePageScrolled } from "../../../util/usePageScrolled.js";
import styles from "./PageScrolledSentinel.module.scss";

export const PageScrolledSentinel = () => {
  return <div className={styles.root} ref={usePageScrolled()} aria-hidden="true" />;
};
