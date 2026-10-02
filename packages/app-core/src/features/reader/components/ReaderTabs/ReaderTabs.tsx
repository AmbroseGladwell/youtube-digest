import type { CSSProperties, Ref } from "react";
import { ReaderTabChoice } from "@overview/domain";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { READER_TABS, type ReaderTab } from "../../types/ReaderTab.js";
import { useTabIndicator } from "./useTabIndicator.js";
import styles from "./ReaderTabs.module.scss";
import { readerTabsTestIds } from "./ReaderTabsTestIds.js";

export interface ReaderTabsProps {
  active: ReaderTab;
  panelId: (tab: ReaderTab) => string;
  tabId: (tab: ReaderTab) => string;
  onChange: (tab: ReaderTab) => void;
  ref?: Ref<HTMLDivElement>;
}

const readerTabChoice = (tab: ReaderTab): ReaderTabChoice => ReaderTabChoice.parse(tab.toLowerCase());

export function ReaderTabs({ active, panelId, tabId, onChange, ref }: ReaderTabsProps) {
  const indicator = useTabIndicator(active);
  const analytics = useOverviewPageAnalytics();
  const choose = (tab: ReaderTab) => {
    if (tab !== active) analytics.tabs.switched({ tab: readerTabChoice(tab) });
    onChange(tab);
  };

  return (
    <div
      className={styles.root}
      ref={ref}
      role="tablist"
      aria-label="Note views"
      data-testid={readerTabsTestIds.root}
    >
      <div className={styles.column}>
        <div className={styles.track}>
          {READER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={tabId(tab)}
              ref={indicator.tabRef[tab]}
              aria-selected={tab === active}
              aria-controls={panelId(tab)}
              className={`${styles.tab} ${tab === active ? styles.tabActive : ""}`}
              onClick={() => choose(tab)}
              data-testid={readerTabsTestIds.tab(tab)}
            >
              {tab}
            </button>
          ))}
          <span
            className={styles.indicator}
            aria-hidden="true"
            style={
              {
                "--tab-offset": `${indicator.offset}px`,
                "--tab-width": `${indicator.width}px`,
              } as CSSProperties
            }
            data-testid={readerTabsTestIds.indicator}
          />
        </div>
      </div>
    </div>
  );
}
