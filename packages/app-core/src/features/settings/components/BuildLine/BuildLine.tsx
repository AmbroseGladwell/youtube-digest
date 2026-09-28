import { useAppBuild } from "../../../../app/AppBuildContext.js";
import { buildLabel } from "../../util/buildLabel.js";
import styles from "./BuildLine.module.scss";
import { buildLineTestIds } from "./BuildLineTestIds.js";

export function BuildLine() {
  const build = useAppBuild();
  if (build === null) return null;

  return (
    <p className={styles.root} data-testid={buildLineTestIds.root}>
      {buildLabel(build)}
    </p>
  );
}
