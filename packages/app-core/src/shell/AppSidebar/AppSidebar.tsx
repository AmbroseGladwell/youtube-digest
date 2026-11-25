import { useState } from "react";
import { useLocation } from "react-router";
import { MILESTONES, spokenTimeSaved, timeSavedSummary, type Topic } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import { PageLink } from "../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../features/analytics/AnalyticsContext.js";
import { useQueueCount } from "../../features/captureQueue/useQueueCount.js";
import { NewTopicDialog } from "../../features/library/components/NewTopicDialog/NewTopicDialog.js";
import { useLibraryViewLink } from "../../features/library/useLibraryViewLink.js";
import { parseLibraryView } from "../../features/library/util/libraryFilterParams.js";
import { useCreateTopicMutation } from "../../features/overviews/mutations/useCreateTopicMutation.js";
import { useOverviewsWithStateQuery } from "../../features/overviews/queries/overviewsWithStateQuery.js";
import { useTopicsQuery } from "../../features/overviews/queries/topicsQuery.js";
import { readableEntries } from "../../features/overviews/types/LibraryEntry.js";
import type { OverviewWithState } from "../../features/overviews/types/OverviewWithState.js";
import { unsortedOverviews } from "../../features/overviews/util/topicCounts.js";
import { useNewProject } from "../../features/projects/useNewProject.js";
import { useProjectSummaries } from "../../features/projects/useProjectSummaries.js";
import { projectMarkColour } from "../../features/projects/util/projectMarkColour.js";
import { activeSummaries, archivedSummaries } from "../../features/projects/util/projectSummaries.js";
import { TimeSavedFigure } from "../../features/timeSaved/components/TimeSavedFigure/TimeSavedFigure.js";
import { TimeSavedSheet } from "../../features/timeSaved/components/TimeSavedSheet/TimeSavedSheet.js";
import { milestoneColourStyle } from "../../features/timeSaved/util/milestoneColourStyle.js";
import styles from "./AppSidebar.module.scss";
import { appSidebarTestIds } from "./AppSidebarTestIds.js";

export interface AppSidebarProps {
  onHide: () => void;
}

const PROJECTS_SHOWN = 5;
const TOPICS_SHOWN = 7;
const CURRENT = "page";

interface TopicLine {
  topic: Topic;
  count: number;
  read: number;
}

const topicLines = (topics: Topic[], overviews: OverviewWithState[]): TopicLine[] =>
  topics.map((topic) => {
    const inIt = overviews.filter(({ overview }) => overview.topicIds.includes(topic.id));
    return { topic, count: inIt.length, read: inIt.filter(({ state }) => state.read).length };
  });

const overviewsWord = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// Design 399c-4 (C1): pages, projects, topics and time saved: docs/features/navigation.md, "The sidebar".
export const AppSidebar = ({ onHide }: AppSidebarProps) => {
  const { pathname, search } = useLocation();
  const analytics = useAnalytics();
  const overviews = readableEntries(useOverviewsWithStateQuery().data ?? []);
  const topics = useTopicsQuery().data ?? [];
  const { summaries } = useProjectSummaries(overviews);
  const queue = useQueueCount();
  const newProject = useNewProject(summaries.map(({ project }) => project.name));
  const createTopic = useCreateTopicMutation();
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [allTopicsShown, setAllTopicsShown] = useState(false);
  const [timeSavedOpen, setTimeSavedOpen] = useState(false);

  const onHome = pathname === Routes.home();
  const homeParams = new URLSearchParams(search);
  const chosenTopic = onHome ? parseLibraryView(homeParams).filters.topicId : "all";
  const active = activeSummaries(summaries);
  const archived = archivedSummaries(summaries).length;
  const shownProjects = active.slice(0, PROJECTS_SHOWN);
  const currentProject = active.find(({ project }) => pathname === Routes.project(project.id));
  const listedProjects =
    currentProject === undefined || shownProjects.includes(currentProject) ? shownProjects : [...shownProjects, currentProject];
  const allProjectsLabel = `${active.length > PROJECTS_SHOWN ? `All ${active.length} projects` : "All projects"}${archived > 0 ? ` · ${archived} archived` : ""}`;
  const lines = topicLines(topics, overviews);
  const listedTopics = allTopicsShown
    ? lines
    : [...lines.slice(0, TOPICS_SHOWN), ...lines.slice(TOPICS_SHOWN).filter(({ topic }) => topic.id === chosenTopic)];
  const timeSaved = timeSavedSummary(overviews);
  const next = MILESTONES.find((milestone) => milestone.minutes > timeSaved.minutes);
  const from = MILESTONES.filter((milestone) => milestone.minutes <= timeSaved.minutes).at(-1)?.minutes ?? 0;

  const viewLink = useLibraryViewLink();
  const page = (name: "Overviews" | "Projects", to: string, icon: "list" | "folder", on: boolean) => (
    <PageLink
      className={`${styles.page} ${on ? styles.on : ""}`}
      to={to}
      aria-current={on ? CURRENT : undefined}
      onClick={() => analytics.app.nav.pageChosen({ page: name === "Overviews" ? "overviews" : "projects", from: "sidebar" })}
      data-testid={appSidebarTestIds.page(name)}
    >
      <StrokeIcon name={icon} size={17} />
      {name}
    </PageLink>
  );
  const plus = (label: string, testId: string, onPress: () => void) => (
    <span className={styles.plusHost}>
      <button type="button" className={styles.plus} aria-label={label} onClick={onPress} data-testid={testId}>
        <StrokeIcon name="plus" size={15} />
      </button>
      <span className={styles.tip} aria-hidden="true">
        {label}
      </span>
    </span>
  );

  return (
    <aside className={styles.root} aria-label="Sidebar" data-testid={appSidebarTestIds.root}>
      <nav aria-label="Pages" className={styles.pages}>
        {page("Overviews", Routes.home(), "list", onHome && chosenTopic === "all")}
        {page("Projects", Routes.projects(), "folder", pathname === Routes.projects())}
        {queue !== null && (
          <PageLink
            className={`${styles.page} ${pathname === Routes.queue() ? styles.on : ""}`}
            to={Routes.queue()}
            aria-current={pathname === Routes.queue() ? CURRENT : undefined}
            onClick={() => analytics.app.nav.pageChosen({ page: "queue", from: "sidebar" })}
            data-testid={appSidebarTestIds.queue}
          >
            <StrokeIcon name="clock" size={17} />
            Queue
            <small className={queue.attention > 0 ? styles.attention : styles.count}>
              {queue.attention > 0 ? `${queue.attention.toLocaleString("en-GB")} needs you · ` : ""}
              {queue.queued.toLocaleString("en-GB")}
            </small>
          </PageLink>
        )}
      </nav>

      <h2 className={styles.heading}>
        Projects
        {plus("New project", appSidebarTestIds.newProject, () => newProject.open("sidebar"))}
      </h2>
      {listedProjects.length > 0 && (
        <ul className={styles.list} aria-label="Projects">
          {listedProjects.map(({ project, items }) => {
            const on = project === currentProject?.project;
            return (
              <li key={project.id}>
                <PageLink
                  className={`${styles.item} ${on ? styles.on : ""}`}
                  to={Routes.project(project.id)}
                  aria-current={on ? CURRENT : undefined}
                  aria-label={`${project.name}, ${overviewsWord(items.length)}`}
                  onClick={() => analytics.app.nav.quickAccessChosen({ kind: "project" })}
                  data-testid={appSidebarTestIds.project(project.name)}
                >
                  <i className={styles.mark} style={{ background: projectMarkColour(project.id) }} aria-hidden="true" />
                  <span className={styles.name}>{project.name}</span>
                  <small className={styles.count}>{items.length}</small>
                </PageLink>
              </li>
            );
          })}
        </ul>
      )}
      {active.length + archived > 0 && (
        <PageLink
          className={`${styles.item} ${styles.more}`}
          to={Routes.projects()}
          onClick={() => analytics.app.nav.pageChosen({ page: "projects", from: "sidebar" })}
          data-testid={appSidebarTestIds.allProjects}
        >
          {allProjectsLabel}
        </PageLink>
      )}

      <h2 className={styles.heading}>
        Topics
        {plus("New topic", appSidebarTestIds.newTopic, () => {
          analytics.library.newTopicDialog.opened();
          setNewTopicOpen(true);
        })}
      </h2>
      {listedTopics.length > 0 && (
        <ul className={styles.list} aria-label="Topics">
          {listedTopics.map((line) => {
            const on = line.topic.id === chosenTopic;
            const link = viewLink({ topicId: on ? "all" : line.topic.id });
            return (
              <li key={line.topic.id}>
                <PageLink
                  className={`${styles.item} ${on ? styles.on : ""}`}
                  to={link.to}
                  aria-current={on ? "true" : undefined}
                  aria-label={`${line.topic.name}, ${overviewsWord(line.count)}, ${line.count - line.read} unread`}
                  onClick={() => {
                    analytics.app.nav.quickAccessChosen({ kind: "topic" });
                    link.follow();
                  }}
                  data-testid={appSidebarTestIds.topic(line.topic.name)}
                >
                  <span className={styles.name}>{line.topic.name}</span>
                  <small className={styles.count}>{line.count}</small>
                  <span className={styles.readBar} aria-hidden="true">
                    <b style={{ width: `${line.count === 0 ? 0 : Math.round((line.read / line.count) * 100)}%` }} />
                  </span>
                </PageLink>
              </li>
            );
          })}
        </ul>
      )}
      {lines.length > TOPICS_SHOWN && (
        <button
          type="button"
          className={`${styles.item} ${styles.more}`}
          aria-expanded={allTopicsShown}
          onClick={() => setAllTopicsShown(!allTopicsShown)}
          data-testid={appSidebarTestIds.allTopics}
        >
          {allTopicsShown ? "Show fewer" : `Show all ${lines.length} topics`}
        </button>
      )}

      <div className={styles.dock}>
        <button
          type="button"
          className={styles.saved}
          aria-haspopup="dialog"
          aria-expanded={timeSavedOpen}
          onClick={() => {
            analytics.timeSaved.library.breakdownOpened();
            setTimeSavedOpen(true);
          }}
          data-testid={appSidebarTestIds.timeSaved}
        >
          <span className={styles.savedLabel}>Time saved</span>
          <span className={styles.savedFigure}>
            <TimeSavedFigure minutes={timeSaved.minutes} />
            <span className={styles.spoken}>{spokenTimeSaved(timeSaved.minutes)}</span>
          </span>
          {next !== undefined && (
            <>
              <span className={styles.savedTrack} style={milestoneColourStyle(next.id)}>
                <i style={{ width: `${((timeSaved.minutes - from) / (next.minutes - from)) * 100}%` }} />
              </span>
              <span className={styles.savedNext}>
                Next: {next.label} · {next.minutes - timeSaved.minutes} min to go
              </span>
            </>
          )}
        </button>

        <div className={styles.foot}>
          <span className={styles.hideHost}>
            <button
              type="button"
              className={styles.hide}
              aria-label="Hide sidebar"
              aria-expanded="true"
              aria-keyshortcuts="["
              onClick={onHide}
              data-testid={appSidebarTestIds.hide}
            >
              <StrokeIcon name="panelClose" size={17} />
            </button>
            <span className={styles.tip} aria-hidden="true">
              Hide sidebar · [
            </span>
          </span>
        </div>
      </div>

      {newProject.dialog}
      {newTopicOpen && (
        <NewTopicDialog
          open
          unsorted={unsortedOverviews(overviews.map(({ overview }) => overview))}
          busy={createTopic.isPending}
          onCreate={(input) => {
            createTopic.mutate(input, {
              onSuccess: (topic) => {
                analytics.library.newTopicDialog.created({ topicId: topic.id, filed: input.overviews.length });
                setNewTopicOpen(false);
              },
            });
          }}
          onPick={(overviewId, picked) => analytics.library.newTopicDialog.overviewPicked({ overviewId, picked })}
          onClose={() => {
            analytics.library.newTopicDialog.cancelled();
            setNewTopicOpen(false);
          }}
        />
      )}
      {timeSavedOpen && (
        <TimeSavedSheet
          open
          summary={timeSaved}
          onClose={() => {
            analytics.timeSaved.library.breakdownClosed();
            setTimeSavedOpen(false);
          }}
        />
      )}
    </aside>
  );
};
