import { READER_TABS, type ReaderTab } from "../../types/ReaderTab.js";
import styles from "./ReaderTabs.module.scss";
import { readerTabsTestIds } from "./ReaderTabsTestIds.js";

export interface ReaderTabsProps {
  active: ReaderTab;
  panelId: (tab: ReaderTab) => string;
  tabId: (tab: ReaderTab) => string;
  onChange: (tab: ReaderTab) => void;
}

export function ReaderTabs({ active, panelId, tabId, onChange }: ReaderTabsProps) {
  return (
    <div className={styles.root} role="tablist" aria-label="Note views" data-testid={readerTabsTestIds.root}>
      {READER_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={tabId(tab)}
          aria-selected={tab === active}
          aria-controls={panelId(tab)}
          className={`${styles.tab} ${tab === active ? styles.tabActive : ""}`}
          onClick={() => onChange(tab)}
          data-testid={readerTabsTestIds.tab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
