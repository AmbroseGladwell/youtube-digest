import { useId, useState, type ReactNode } from "react";
import { NOVELTY_LABEL, NOVELTY_ORDER, type Topic } from "@overview/domain";
import { ChoiceGroup, type Choice } from "../../../../components/shared/ChoiceGroup/ChoiceGroup.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import {
  LIBRARY_ADDED,
  LIBRARY_ADDED_LABEL,
  LIBRARY_KIND_LABEL,
  LIBRARY_KINDS,
  type LibraryFilters,
  type LibrarySourceId,
} from "../../types/LibraryFilters.js";
import type { LibraryFilterCounts } from "../../util/libraryFilterCounts.js";
import { SourceTile } from "../SourceTile/SourceTile.js";
import styles from "./FilterMenu.module.scss";
import { filterMenuTestIds } from "./FilterMenuTestIds.js";

export type FoldedGroup = "source" | "topic" | "tags" | "verdict";
export type LongList = "source" | "tags";

const TOPICS_SHOWN = 7;
const SHOW_FEWER = "Show fewer";
const NO_TOPIC = "No topic";

export interface FilterGroupsProps {
  filters: LibraryFilters;
  topics: Topic[];
  counts: LibraryFilterCounts;
  onChange: (patch: Partial<LibraryFilters>) => void;
  onNewTopic: () => void;
  onManageTags: () => void;
  topShown: number;
  onShowAll: ((list: LongList) => void) | null;
}

const toggled = <T,>(values: readonly T[], value: T, on: boolean): T[] =>
  on ? [...values.filter((each) => each !== value), value] : values.filter((each) => each !== value);

const chosenSummary = (names: readonly string[]): string => {
  if (names.length === 0) {
    return "Any";
  }
  return names.length === 1 ? names[0]! : `${names.length} chosen`;
};

export const sourceChoices = (counts: LibraryFilterCounts, ids: readonly LibrarySourceId[]): Choice[] =>
  counts.bySource
    .filter((source) => ids.includes(source.id))
    .map((source) => ({
      value: source.id,
      label: source.name,
      ...(source.platform === "website" && source.domain !== null && source.domain !== source.name ? { detail: source.domain } : {}),
      count: source.count,
      leading: <SourceTile source={source} />,
      testId: filterMenuTestIds.choice("source", source.id),
    }));

export const tagChoices = (counts: LibraryFilterCounts, tags: readonly string[]): Choice[] =>
  counts.byTag
    .filter(({ tag }) => tags.includes(tag))
    .map(({ tag, count }) => ({ value: tag, label: `#${tag}`, count, testId: filterMenuTestIds.choice("tags", tag) }));

export const matchingSources = (counts: LibraryFilterCounts, query: string): LibrarySourceId[] => {
  const words = query.trim().toLowerCase();
  return counts.bySource
    .filter((source) => words === "" || `${source.name} ${source.domain ?? ""}`.toLowerCase().includes(words))
    .map((source) => source.id);
};

export const matchingTags = (counts: LibraryFilterCounts, query: string): string[] => {
  const words = query.trim().toLowerCase().replace(/^#/, "");
  return counts.byTag.filter(({ tag }) => words === "" || tag.includes(words)).map(({ tag }) => tag);
};

const withChosen = <T,>(shown: readonly T[], all: readonly T[], chosen: readonly T[]): T[] => [
  ...shown,
  ...all.filter((value) => chosen.includes(value) && !shown.includes(value)),
];

interface FoldProps {
  group: FoldedGroup;
  title: string;
  value: string;
  set: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const Fold = ({ group, title, value, set, open, onToggle, children }: FoldProps) => {
  const bodyId = useId();
  return (
    <div className={styles.fold} data-testid={filterMenuTestIds.group(group)}>
      <button
        type="button"
        className={styles.foldHead}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        data-testid={filterMenuTestIds.fold(group)}
      >
        <span>{title}</span>
        <span className={`${styles.foldValue} ${set ? styles.foldValueSet : ""}`} data-testid={filterMenuTestIds.foldValue(group)}>
          {value}
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true">
          <StrokeIcon name="chevronDown" size={15} />
        </span>
      </button>
      {open && (
        <div id={bodyId} className={styles.foldBody}>
          {children}
        </div>
      )}
    </div>
  );
};

export interface ListSearchProps {
  group: LongList;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const ListSearch = ({ group, label, value, onChange }: ListSearchProps) => (
  <label className={styles.search}>
    <StrokeIcon name="search" size={15} />
    <input
      type="search"
      className={styles.searchInput}
      placeholder={label}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-testid={filterMenuTestIds.search(group)}
    />
  </label>
);

// One set of groups for the popover and the phone sheet: design 399o.
export const FilterGroups = ({ filters, topics, counts, onChange, onNewTopic, onManageTags, topShown, onShowAll }: FilterGroupsProps) => {
  const [open, setOpen] = useState<FoldedGroup | null>(null);
  const [allTopics, setAllTopics] = useState(false);
  const [sourceQuery, setSourceQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [allListed, setAllListed] = useState<LongList[]>([]);
  const showAll = (list: LongList) => {
    if (onShowAll === null) {
      setAllListed((listed) => (listed.includes(list) ? listed.filter((each) => each !== list) : [...listed, list]));
    } else {
      onShowAll(list);
    }
  };
  const listedInFull = (list: LongList) => onShowAll === null && allListed.includes(list);
  const fold = (group: FoldedGroup) => ({ open: open === group, onToggle: () => setOpen(open === group ? null : group) });

  const show: Choice[] = [
    { value: "unread", label: "Unread", count: counts.unread, testId: filterMenuTestIds.choice("show", "unread") },
    { value: "favourite", label: "Favourite", count: counts.favourite, testId: filterMenuTestIds.choice("show", "favourite") },
    ...(counts.withoutOverview > 0 || filters.withoutOverview
      ? [{ value: "pending", label: "No overview yet", count: counts.withoutOverview, testId: filterMenuTestIds.choice("show", "pending") }]
      : []),
  ];
  const shownChosen = [
    ...(filters.status === "unread" ? ["unread"] : []),
    ...(filters.favourite ? ["favourite"] : []),
    ...(filters.withoutOverview ? ["pending"] : []),
  ];
  const kinds = LIBRARY_KINDS.filter((kind) => (counts.byKind[kind] ?? 0) > 0 || filters.kinds.includes(kind));

  const sourceIds = counts.bySource.map((source) => source.id);
  const sourceMatches = matchingSources(counts, sourceQuery);
  const listed = <T,>(list: LongList, query: string, matches: T[], all: T[], top: number, chosen: readonly T[]): T[] => {
    if (query !== "") {
      return matches;
    }
    return listedInFull(list) ? all : withChosen(all.slice(0, top), all, chosen);
  };
  const sourcesShown = listed("source", sourceQuery, sourceMatches, sourceIds, topShown, filters.sources);
  const sourceNames = counts.bySource.filter((source) => filters.sources.includes(source.id)).map((source) => source.name);

  const tags = counts.byTag.map(({ tag }) => tag);
  const tagsShown = listed("tags", tagQuery, matchingTags(counts, tagQuery), tags, 5, filters.tags);

  const topicsShown = allTopics
    ? topics
    : withChosen(
        topics.slice(0, TOPICS_SHOWN),
        topics,
        topics.filter((topic) => topic.id === filters.topicId),
      );
  const topicName = filters.topicId === "none" ? NO_TOPIC : topics.find((topic) => topic.id === filters.topicId)?.name;
  const verdictNames = [...filters.novelties.map((novelty) => NOVELTY_LABEL[novelty]), ...(filters.dubious ? ["Dubious"] : [])];

  return (
    <div className={styles.groups}>
      <div className={`${styles.group} ${styles.firstGroup}`} data-testid={filterMenuTestIds.group("show")}>
        <p className={styles.groupLabel} aria-hidden="true">
          Show
        </p>
        <ChoiceGroup
          legend="Show"
          name="filter-show"
          look="chips"
          multiple
          choices={show}
          chosen={shownChosen}
          onChoose={(value, on) => {
            if (value === "unread") {
              onChange({ status: on ? "unread" : "all" });
            } else if (value === "favourite") {
              onChange({ favourite: on });
            } else {
              onChange({ withoutOverview: on });
            }
          }}
        />
      </div>

      <div className={styles.group} data-testid={filterMenuTestIds.group("added")}>
        <p className={styles.groupLabel} aria-hidden="true">
          Added
        </p>
        <ChoiceGroup
          legend="Added"
          name="filter-added"
          look="chips"
          multiple={false}
          choices={LIBRARY_ADDED.map((added) => ({
            value: added,
            label: LIBRARY_ADDED_LABEL[added],
            testId: filterMenuTestIds.choice("added", added),
          }))}
          chosen={[filters.added]}
          onChoose={(value) => onChange({ added: value as LibraryFilters["added"] })}
        />
      </div>

      {kinds.length > 1 && (
        <div className={styles.group} data-testid={filterMenuTestIds.group("kind")}>
          <p className={styles.groupLabel} aria-hidden="true">
            Kind
          </p>
          <ChoiceGroup
            legend="Kind"
            name="filter-kind"
            look="chips"
            multiple
            choices={kinds.map((kind) => ({
              value: kind,
              label: LIBRARY_KIND_LABEL[kind],
              count: counts.byKind[kind] ?? 0,
              testId: filterMenuTestIds.choice("kind", kind),
            }))}
            chosen={filters.kinds}
            onChoose={(value, on) => onChange({ kinds: toggled(filters.kinds, value as LibraryFilters["kinds"][number], on) })}
          />
        </div>
      )}

      {counts.bySource.length > 1 && (
        <Fold group="source" title="Source" value={chosenSummary(sourceNames)} set={sourceNames.length > 0} {...fold("source")}>
          <ListSearch group="source" label={`Search ${counts.bySource.length} sources`} value={sourceQuery} onChange={setSourceQuery} />
          <ChoiceGroup
            legend="Source"
            name="filter-source"
            look="rows"
            multiple
            choices={sourceChoices(counts, sourcesShown).sort(
              (left, right) => sourcesShown.indexOf(left.value as LibrarySourceId) - sourcesShown.indexOf(right.value as LibrarySourceId),
            )}
            chosen={filters.sources}
            onChoose={(value, on) => onChange({ sources: toggled(filters.sources, value as LibrarySourceId, on) })}
          />
          {sourceQuery === "" && counts.bySource.length > topShown && (
            <button
              type="button"
              className={styles.more}
              onClick={() => showAll("source")}
              aria-expanded={onShowAll === null ? listedInFull("source") : undefined}
              data-testid={filterMenuTestIds.showAll("source")}
            >
              {listedInFull("source") ? SHOW_FEWER : `Show all ${counts.bySource.length} sources`}
            </button>
          )}
        </Fold>
      )}

      <Fold group="topic" title="Topic" value={topicName ?? "Any"} set={topicName !== undefined} {...fold("topic")}>
        <ChoiceGroup
          legend="Topic"
          name="filter-topic"
          look="rows"
          multiple={false}
          choices={[
            { value: "all", label: "All topics", count: counts.total, testId: filterMenuTestIds.choice("topic", "all") },
            ...topicsShown.map((topic) => ({
              value: topic.id as string,
              label: topic.name,
              count: counts.byTopic[topic.id] ?? 0,
              testId: filterMenuTestIds.choice("topic", topic.id),
            })),
            {
              value: "none",
              label: NO_TOPIC,
              detail: "not in any topic yet",
              count: counts.noTopic,
              testId: filterMenuTestIds.choice("topic", "none"),
            },
          ]}
          chosen={[filters.topicId]}
          onChoose={(value) => onChange({ topicId: value as LibraryFilters["topicId"] })}
        />
        <div className={styles.foldLinks}>
          {topics.length > TOPICS_SHOWN && (
            <button
              type="button"
              className={styles.more}
              onClick={() => setAllTopics(!allTopics)}
              aria-expanded={allTopics}
              data-testid={filterMenuTestIds.showAll("topic")}
            >
              {allTopics ? SHOW_FEWER : `Show all ${topics.length} topics`}
            </button>
          )}
          <button type="button" className={styles.link} onClick={onNewTopic} data-testid={filterMenuTestIds.newTopic}>
            <StrokeIcon name="plus" size={14} />
            New topic
          </button>
        </div>
      </Fold>

      {counts.byTag.length > 0 && (
        <Fold
          group="tags"
          title="Tags"
          value={filters.tags.length === 1 ? `#${filters.tags[0]}` : chosenSummary(filters.tags)}
          set={filters.tags.length > 0}
          {...fold("tags")}
        >
          <ListSearch group="tags" label={`Search ${counts.byTag.length} tags`} value={tagQuery} onChange={setTagQuery} />
          <ChoiceGroup
            legend="Tags"
            name="filter-tags"
            look="rows"
            multiple
            choices={tagChoices(counts, tagsShown).sort((left, right) => tagsShown.indexOf(left.value) - tagsShown.indexOf(right.value))}
            chosen={filters.tags}
            onChoose={(value, on) => onChange({ tags: toggled(filters.tags, value, on) })}
          />
          <div className={styles.foldLinks}>
            {tagQuery === "" && counts.byTag.length > 5 && (
              <button
                type="button"
                className={styles.more}
                onClick={() => showAll("tags")}
                aria-expanded={onShowAll === null ? listedInFull("tags") : undefined}
                data-testid={filterMenuTestIds.showAll("tags")}
              >
                {listedInFull("tags") ? SHOW_FEWER : `Show all ${counts.byTag.length} tags`}
              </button>
            )}
            <button type="button" className={styles.link} onClick={onManageTags} data-testid={filterMenuTestIds.manageTags}>
              Manage tags
              <StrokeIcon name="arrowRight" size={14} />
            </button>
          </div>
        </Fold>
      )}

      <Fold group="verdict" title="Verdict" value={chosenSummary(verdictNames)} set={verdictNames.length > 0} {...fold("verdict")}>
        <ChoiceGroup
          legend="Verdict"
          name="filter-verdict"
          look="chips"
          multiple
          choices={[
            ...NOVELTY_ORDER.map((novelty) => ({
              value: novelty as string,
              label: NOVELTY_LABEL[novelty],
              count: counts.byNovelty[novelty] ?? 0,
              testId: filterMenuTestIds.choice("verdict", novelty),
            })),
            { value: "dubious", label: "⚠ Dubious", count: counts.dubious, testId: filterMenuTestIds.choice("verdict", "dubious") },
          ]}
          chosen={[...filters.novelties, ...(filters.dubious ? ["dubious"] : [])]}
          onChoose={(value, on) => {
            if (value === "dubious") {
              onChange({ dubious: on });
            } else {
              onChange({ novelties: toggled(filters.novelties, value as LibraryFilters["novelties"][number], on) });
            }
          }}
        />
      </Fold>
    </div>
  );
};
