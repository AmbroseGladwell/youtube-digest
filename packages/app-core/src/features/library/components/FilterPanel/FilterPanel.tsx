import { useState, type ReactNode } from "react";
import { NOVELTY_LABEL, NOVELTY_ORDER, type Novelty, type Topic } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { LibraryFilterCounts } from "../../util/libraryFilterCounts.js";
import { LIBRARY_KIND_LABEL, LIBRARY_KINDS, type LibraryFilters } from "../../types/LibraryFilters.js";
import { cappedTags } from "../../util/cappedTags.js";
import { cappedTopics } from "../../util/cappedTopics.js";
import styles from "./FilterPanel.module.scss";
import { filterPanelTestIds } from "./FilterPanelTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface FilterPanelProps {
  filters: LibraryFilters;
  topics: Topic[];
  counts: LibraryFilterCounts;
  onChange: (patch: Partial<LibraryFilters>) => void;
  onNewTopic: () => void;
  onManageTags: () => void;
  projects?: ReactNode;
}

const MORE_PANEL_ID = "FilterPanel-more";

const moreSummary = (filters: LibraryFilters): string => {
  const verdict = [...filters.novelties.map((novelty) => NOVELTY_LABEL[novelty]), ...(filters.dubious ? ["Dubious only"] : [])];
  return [
    ...filters.kinds.map((kind) => LIBRARY_KIND_LABEL[kind]),
    ...(verdict.length === 0 ? ["Any verdict"] : verdict),
    ...filters.tags.map((tag) => `#${tag}`),
  ].join(" · ");
};

export const FilterPanel = ({ filters, topics, counts, onChange, onNewTopic, onManageTags, projects = null }: FilterPanelProps) => {
  const [allTopicsShown, setAllTopicsShown] = useState(false);
  const tagKey = filters.tags.join(",");
  const [moreShown, setMoreShown] = useState(tagKey !== "");
  const [shownForTags, setShownForTags] = useState(tagKey);
  if (shownForTags !== tagKey) {
    setShownForTags(tagKey);
    if (tagKey !== "") {
      setMoreShown(true);
    }
  }
  const [allTagsShown, setAllTagsShown] = useState(false);
  const analytics = useAnalytics();
  const capped = cappedTopics(topics, filters.topicId);
  const shownTopics = allTopicsShown ? topics : capped.shown;
  const tags = cappedTags(counts.byTag, filters.tags);
  const shownTags = allTagsShown ? counts.byTag : tags.shown;
  const kinds = LIBRARY_KINDS.filter((kind) => (counts.byKind[kind] ?? 0) > 0);

  return (
    <div className={styles.root} data-testid={filterPanelTestIds.root}>
      <div className={styles.group}>
        <p className={styles.label}>Show</p>
        <Toggle
          active={filters.status === "unread"}
          count={counts.unread}
          onClick={() => onChange({ status: filters.status === "unread" ? "all" : "unread" })}
          testId={filterPanelTestIds.statusChip("unread")}
        >
          Unread
        </Toggle>
        <Toggle
          active={filters.favourite}
          count={counts.favourite}
          onClick={() => onChange({ favourite: !filters.favourite })}
          testId={filterPanelTestIds.favouriteChip}
        >
          Favourite
        </Toggle>
        {(counts.withoutOverview > 0 || filters.withoutOverview) && (
          <Toggle
            active={filters.withoutOverview}
            count={counts.withoutOverview}
            onClick={() => onChange({ withoutOverview: !filters.withoutOverview })}
            testId={filterPanelTestIds.withoutOverviewChip}
          >
            No overview yet
          </Toggle>
        )}
      </div>
      {projects}

      <div className={styles.group}>
        <p className={styles.label}>Topic</p>
        {topics.length > 0 && (
          <div className={styles.list} role="group" aria-label="Filter by topic">
            <ListOption
              active={filters.topicId === "all"}
              count={counts.total}
              onClick={() => onChange({ topicId: "all" })}
              testId={filterPanelTestIds.topicChip("all")}
            >
              All topics
            </ListOption>
            {shownTopics.map((topic) => (
              <ListOption
                key={topic.id}
                active={filters.topicId === topic.id}
                count={counts.byTopic[topic.id] ?? 0}
                onClick={() => onChange({ topicId: topic.id })}
                testId={filterPanelTestIds.topicChip(topic.id)}
              >
                {topic.name}
              </ListOption>
            ))}
          </div>
        )}
        {capped.hiddenCount > 0 && (
          <button
            type="button"
            className={styles.moreTopics}
            onClick={() => {
              analytics.library.filters.allTopicsShown({ shown: !allTopicsShown });
              setAllTopicsShown(!allTopicsShown);
            }}
            aria-expanded={allTopicsShown}
            data-testid={filterPanelTestIds.showAllTopicsButton}
          >
            {allTopicsShown ? "Show fewer" : `Show all ${topics.length} topics`}
          </button>
        )}
        <button type="button" className={styles.newTopic} onClick={onNewTopic} data-testid={filterPanelTestIds.newTopicButton}>
          <StrokeIcon name="plus" />
          New topic
        </button>
      </div>

      <div className={styles.more}>
        <button
          type="button"
          className={styles.moreButton}
          onClick={() => {
            analytics.library.filters.moreShown({ shown: !moreShown });
            setMoreShown(!moreShown);
          }}
          aria-expanded={moreShown}
          aria-controls={MORE_PANEL_ID}
          data-testid={filterPanelTestIds.moreFiltersButton}
        >
          <span>More filters</span>
          <span className={styles.moreSummary}>
            <span className={styles.moreSummaryText} data-testid={filterPanelTestIds.moreFiltersSummary}>
              {moreSummary(filters)}
            </span>
            <span className={`${styles.chevron} ${moreShown ? styles.chevronOpen : ""}`} aria-hidden="true">
              <StrokeIcon name="chevronDown" size={14} />
            </span>
          </span>
        </button>
        <div id={MORE_PANEL_ID} className={`${styles.morePanel} ${moreShown ? styles.morePanelOpen : ""}`} inert={!moreShown}>
          <div className={styles.morePanelInner}>
            {kinds.length > 1 && (
              <>
                <p className={styles.label}>Kind</p>
                <div className={styles.list} role="group" aria-label="Filter by kind">
                  <ListOption
                    active={filters.kinds.length === 0}
                    count={counts.total}
                    onClick={() => onChange({ kinds: [] })}
                    testId={filterPanelTestIds.sourceChip("all")}
                  >
                    Any kind
                  </ListOption>
                  {kinds.map((kind) => (
                    <ListOption
                      key={kind}
                      active={filters.kinds.includes(kind)}
                      count={counts.byKind[kind] ?? 0}
                      onClick={() => onChange({ kinds: [kind] })}
                      testId={filterPanelTestIds.sourceChip(kind)}
                    >
                      {LIBRARY_KIND_LABEL[kind]}
                    </ListOption>
                  ))}
                </div>
              </>
            )}
            <p className={styles.label}>Verdict</p>
            <div className={styles.list} role="group" aria-label="Filter by verdict">
              <ListOption
                active={filters.novelties.length === 0}
                count={counts.total}
                onClick={() => onChange({ novelties: [] })}
                testId={filterPanelTestIds.noveltyChip("all")}
              >
                Any verdict
              </ListOption>
              {NOVELTY_ORDER.map((novelty: Novelty) => (
                <ListOption
                  key={novelty}
                  active={filters.novelties.includes(novelty)}
                  count={counts.byNovelty[novelty] ?? 0}
                  onClick={() => onChange({ novelties: [novelty] })}
                  testId={filterPanelTestIds.noveltyChip(novelty)}
                >
                  {NOVELTY_LABEL[novelty]}
                </ListOption>
              ))}
              <ListOption
                active={filters.dubious}
                count={counts.dubious}
                accent
                onClick={() => onChange({ dubious: !filters.dubious })}
                testId={filterPanelTestIds.dubiousChip}
              >
                Dubious only
              </ListOption>
            </div>
            {counts.byTag.length > 0 && (
              <>
                <p className={styles.label}>Tags</p>
                <div className={styles.list} role="group" aria-label="Filter by tag">
                  {shownTags.map(({ tag, count }) => (
                    <ListOption
                      key={tag}
                      active={filters.tags.includes(tag)}
                      count={count}
                      onClick={() =>
                        onChange({
                          tags: filters.tags.includes(tag) ? filters.tags.filter((chosen) => chosen !== tag) : [...filters.tags, tag],
                        })
                      }
                      testId={filterPanelTestIds.tagChip(tag)}
                    >
                      {`#${tag}`}
                    </ListOption>
                  ))}
                </div>
                {tags.hiddenCount > 0 && (
                  <button
                    type="button"
                    className={styles.moreTopics}
                    onClick={() => {
                      analytics.library.filters.allTagsShown({ shown: !allTagsShown });
                      setAllTagsShown(!allTagsShown);
                    }}
                    aria-expanded={allTagsShown}
                    data-testid={filterPanelTestIds.showAllTagsButton}
                  >
                    {allTagsShown ? "Show fewer" : `Show all ${counts.byTag.length}`}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.manageTags}
                  onClick={onManageTags}
                  data-testid={filterPanelTestIds.manageTagsButton}
                >
                  <StrokeIcon name="pencil" />
                  Manage tags
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToggleProps {
  active: boolean;
  count: number;
  onClick: () => void;
  testId: string;
  children: string;
}

const Toggle = ({ active, count, onClick, testId, children }: ToggleProps) => {
  return (
    <button type="button" className={`${styles.option} ${styles.toggle}`} onClick={onClick} aria-pressed={active} data-testid={testId}>
      <span className={styles.optionLabel}>
        <span className={`${styles.box} ${active ? styles.boxChecked : ""}`} aria-hidden="true">
          {active && <StrokeIcon name="check" size={11} />}
        </span>
        {children}
      </span>
      <span className={styles.count}>{count}</span>
    </button>
  );
};

interface ListOptionProps {
  active: boolean;
  count: number;
  accent?: boolean;
  onClick: () => void;
  testId: string;
  children: string;
}

const ListOption = ({ active, count, accent, onClick, testId, children }: ListOptionProps) => {
  return (
    <button
      type="button"
      className={`${styles.option} ${active ? styles.optionActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
    >
      <span className={styles.optionLabel}>
        {accent && (
          <span className={styles.accentMark} aria-hidden="true">
            <StrokeIcon name="alert" size={13} />
          </span>
        )}
        {children}
      </span>
      <span className={styles.count}>{count}</span>
    </button>
  );
};
