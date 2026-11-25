import { domainOf } from "@overview/domain";
import { keptLinkKind } from "../../util/keptLinkKind.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useKeptLinksController } from "../../KeptLinksContext.js";
import styles from "./KeptHereBanner.module.scss";
import { keptHereBannerTestIds } from "./KeptHereBannerTestIds.js";

const siteOf = (url: string): string => (keptLinkKind({ url, source: null }) === "tiktok" ? "TikTok" : domainOf(url));

const plural = (count: number) => (count === 1 ? "link" : "links");

// Design 358j: links kept elsewhere that the extension is making here (docs/features/kept-links.md).
export const KeptHereBanner = () => {
  const kept = useKeptLinksController();
  if (kept === null || !kept.hasExtension) {
    return null;
  }
  const here = kept.links.filter(
    (link) => link.queueStatus === "waiting" && (link.waitingFor === "server" || link.waitingFor === "extension"),
  );
  if (here.length === 0 && kept.making === null) {
    return null;
  }
  const count = here.length + (kept.making !== null && !here.some((link) => link.id === kept.making?.id) ? 1 : 0);
  const fromPhone = [...here, ...(kept.making === null ? [] : [kept.making])].every((link) => link.keptFrom === "phone");
  const from = fromPhone ? "from your phone" : "you kept";
  const [asking] = kept.needsAccess;
  return (
    <div className={styles.root} data-testid={keptHereBannerTestIds.root}>
      <span className={styles.icon} aria-hidden="true">
        <StrokeIcon name={fromPhone ? "smartphone" : "link"} size={15} />
      </span>
      <span className={styles.text}>
        <span role="status" data-testid={keptHereBannerTestIds.says}>
          {kept.making === null
            ? `${count} ${plural(count)} ${from} ${count === 1 ? "is" : "are"} ready to make here.`
            : `Making ${count} ${plural(count)} ${from} here. Keep this panel open until they’re done.`}
        </span>
        {asking !== undefined && kept.making === null && (
          <span className={styles.ask}>
            <span className={styles.askText}>The extension needs your OK to read {siteOf(asking.url)} first.</span>
            <button type="button" className={styles.allow} onClick={() => kept.allow(asking)} data-testid={keptHereBannerTestIds.allow}>
              Allow and make it
            </button>
          </span>
        )}
      </span>
    </div>
  );
};
