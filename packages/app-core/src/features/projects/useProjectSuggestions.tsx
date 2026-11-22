import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { OverviewId } from "@overview/domain";
import { prefersReducedMotion } from "../../util/prefersReducedMotion.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useMeaningMatchesQuery } from "../library/queries/meaningMatchesQuery.js";
import { useTopicsQuery } from "../overviews/queries/topicsQuery.js";
import type { OverviewWithState } from "../overviews/types/OverviewWithState.js";
import { ProjectSuggestions, type SuggestionPhase, type SuggestionRow } from "./components/ProjectSuggestions/ProjectSuggestions.js";
import { useSetProjectMemberMutation } from "./mutations/useSetProjectMemberMutation.js";
import { useStores } from "../../stores/StoresContext.js";
import { projectKeys } from "./projectKeys.js";
import { useProjectTakenOutQuery } from "./queries/projectTakenOutQuery.js";
import { projectSuggestionQuery, projectSuggestions } from "./util/projectSuggestions.js";
import type { ProjectSummary } from "./util/projectSummaries.js";

const LEAVE_MS = 180;
const CLOSE_MS = 220;
// As long as the toast that can undo it shows: until then it is only hidden here.
const TURN_DOWN_HELD_MS = 6000;

export interface SuggestionsHost {
  say: (text: string, undo: () => void) => void;
  focusList: () => void;
  editPurpose: () => void;
}

const later = (ms: number, then: () => void) => window.setTimeout(then, prefersReducedMotion() ? 0 : ms);

// Saved overviews that might fit the project on the page, and what adding or turning one
// down does (docs/features/projects.md, "Offering what's already saved").
export function useProjectSuggestions(current: ProjectSummary | null, overviews: OverviewWithState[], host: SuggestionsHost) {
  const analytics = useAnalytics();
  const setMember = useSetProjectMemberMutation();
  const { projectStore } = useStores();
  const queryClient = useQueryClient();
  const topics = useTopicsQuery().data ?? [];
  const takenOut = useProjectTakenOutQuery().data;
  const live = current !== null && current.project.archivedAt === null;
  const meaning = useMeaningMatchesQuery(live ? projectSuggestionQuery(current.project) : "");
  const id = useId();
  const heading = useRef<HTMLHeadingElement | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [phases, setPhases] = useState<ReadonlyMap<string, SuggestionPhase>>(new Map());
  const ghosts = useRef(new Map<string, OverviewWithState>());
  const [offeredAgain, setOfferedAgain] = useState<ReadonlySet<string>>(new Set());
  const [held, setHeld] = useState<ReadonlyMap<string, number>>(new Map());
  const heldRef = useRef(held);
  heldRef.current = held;
  const [focusAdd, setFocusAdd] = useState<string | null>(null);
  const shownLogged = useRef(false);

  const projectId = current?.project.id ?? null;
  // Straight to the store, so one still held when the page closes is kept.
  const commit = (overviewId: string) => {
    if (projectId === null) {
      return;
    }
    void projectStore
      .turnDownForProject(projectId, overviewId as OverviewId)
      .then(() => queryClient.invalidateQueries({ queryKey: projectKeys.takenOut() }));
  };

  useEffect(
    () => () => {
      for (const [overviewId, timer] of heldRef.current) {
        window.clearTimeout(timer);
        commit(overviewId);
      }
    },
    [],
  );

  if (current !== null && open === null) {
    setOpen(current.items.length === 0);
  }

  const inProject = new Set<string>(current?.items.map((item) => item.overview.id) ?? []);
  const out = new Set<string>([...held.keys()]);
  for (const member of takenOut ?? []) {
    if (member.projectId === projectId && !offeredAgain.has(member.overviewId)) {
      out.add(member.overviewId);
    }
  }
  const offered = !live || takenOut === undefined ? [] : projectSuggestions({ result: meaning.data, overviews, inProject, takenOut: out });
  const byId = new Map<string, OverviewWithState>([
    ...ghosts.current,
    ...offered.map((entry) => [entry.overview.id as string, entry] as const),
  ]);
  // Closest first, a row on its way out included, so one undone comes back where it was.
  const closeness = new Map((meaning.data?.available ? meaning.data.matches : []).map(({ overviewId }, index) => [overviewId, index]));
  const shownIds = [...byId.keys()].sort((left, right) => (closeness.get(left) ?? 0) - (closeness.get(right) ?? 0));
  const topicNamesOf = (entry: OverviewWithState) =>
    topics.filter((topic) => entry.overview.topicIds.includes(topic.id)).map((topic) => topic.name);
  const rows: SuggestionRow[] = shownIds.flatMap((overviewId) => {
    const entry = byId.get(overviewId);
    return entry === undefined ? [] : [{ entry, phase: phases.get(overviewId) ?? "shown", topicNames: topicNamesOf(entry) }];
  });
  const count = rows.filter((row) => row.phase === "shown").length;
  const empty = current?.items.length === 0;

  useEffect(() => {
    if (count === 0 || shownLogged.current || projectId === null) {
      return;
    }
    shownLogged.current = true;
    analytics.projects.suggestions.shown({ projectId, count, empty });
  }, [count, projectId]);

  const setPhase = (overviewIds: string[], phase: SuggestionPhase | null) =>
    setPhases((previous) => {
      const next = new Map(previous);
      for (const overviewId of overviewIds) {
        if (phase === null) {
          next.delete(overviewId);
        } else {
          next.set(overviewId, phase);
        }
      }
      return next;
    });

  // A row fades and slides out, then what it did happens and its space closes; focus goes to
  // the next suggestion's Add, or to the list when none is left ("OV-318 3" 318m, 318q).
  const leave = (entries: OverviewWithState[], then: () => void) => {
    const overviewIds = entries.map(({ overview }) => overview.id as string);
    const remaining = rows.filter((row) => row.phase === "shown" && !overviewIds.includes(row.entry.overview.id));
    const after = remaining.find((row) => shownIds.indexOf(row.entry.overview.id) > shownIds.indexOf(overviewIds[0]!));
    const next = after ?? remaining.at(-1);
    for (const entry of entries) {
      ghosts.current.set(entry.overview.id, entry);
    }
    setPhase(overviewIds, "leaving");
    later(LEAVE_MS, () => {
      then();
      setPhase(overviewIds, "closing");
      if (next === undefined) {
        host.focusList();
      } else {
        setFocusAdd(next.entry.overview.id);
      }
      later(CLOSE_MS, () => {
        for (const overviewId of overviewIds) {
          ghosts.current.delete(overviewId);
        }
        setPhase(overviewIds, null);
      });
    });
  };

  const add = (entries: OverviewWithState[], how: "one" | "all") => {
    if (current === null) {
      return;
    }
    const { project } = current;
    analytics.projects.suggestions.added({ projectId: project.id, count: entries.length, how, empty });
    leave(entries, () => {
      for (const { overview } of entries) {
        analytics.projects.membership.added({ projectId: project.id, overviewId: overview.id, from: "suggestion" });
        setMember.mutate({ projectId: project.id, overviewId: overview.id, inProject: true });
      }
      setOfferedAgain(
        (previous) => new Set([...previous].filter((overviewId) => !entries.some((entry) => entry.overview.id === overviewId))),
      );
      host.say(entries.length === 1 ? `Added to ${project.name}` : `Added ${entries.length} to ${project.name}`, () => {
        analytics.projects.suggestions.undone({ projectId: project.id, action: "add", count: entries.length });
        for (const { overview } of entries) {
          setMember.mutate({ projectId: project.id, overviewId: overview.id, inProject: false });
        }
        setOfferedAgain((previous) => new Set([...previous, ...entries.map(({ overview }) => overview.id as string)]));
      });
    });
  };

  const decline = (entry: OverviewWithState) => {
    if (current === null) {
      return;
    }
    const { project } = current;
    const overviewId = entry.overview.id as string;
    analytics.projects.suggestions.turnedDown({ projectId: project.id, empty });
    leave([entry], () => {
      const timer = window.setTimeout(() => {
        commit(overviewId);
        setHeld((previous) => {
          const next = new Map(previous);
          next.delete(overviewId);
          return next;
        });
      }, TURN_DOWN_HELD_MS);
      setHeld((previous) => new Map(previous).set(overviewId, timer));
      host.say("It won’t be suggested here again", () => {
        analytics.projects.suggestions.undone({ projectId: project.id, action: "turnDown", count: 1 });
        window.clearTimeout(timer);
        setHeld((previous) => {
          const next = new Map(previous);
          next.delete(overviewId);
          return next;
        });
      });
    });
  };

  const visible = current !== null && rows.length > 0 && (open === true || empty);
  const group = !visible ? null : (
    <ProjectSuggestions
      id={id}
      projectName={current.project.name}
      hasPurpose={current.project.purpose !== null}
      rows={rows}
      closing={count === 0}
      headingRef={heading}
      focusAdd={focusAdd}
      onFocused={() => setFocusAdd(null)}
      onAdd={(entry) => add([entry], "one")}
      onAddAll={() =>
        add(
          rows.filter((row) => row.phase === "shown").map((row) => row.entry),
          "all",
        )
      }
      onTurnDown={decline}
      onOpen={() => analytics.projects.suggestions.overviewOpened({ projectId: current.project.id })}
      onAddPurpose={host.editPurpose}
    />
  );

  return {
    group,
    // The line in the head that opens them, for a project that already has overviews ("OV-318 2" 318g).
    line:
      current === null || empty || count === 0
        ? null
        : {
            count,
            open: open === true,
            controls: id,
            onToggle: () => {
              const opening = open !== true;
              setOpen(opening);
              if (opening) {
                analytics.projects.suggestions.opened({ projectId: current.project.id, count });
                requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
              }
            },
          },
    // An empty project with suggestions above it says what else can fill it (318a, 318d).
    offering: count > 0,
  };
}
