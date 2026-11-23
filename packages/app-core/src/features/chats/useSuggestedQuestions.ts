import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  chatSourceKind,
  sourceImage,
  type OverviewId,
  type Plan,
  type ProjectId,
  type SuggestedQuestion,
  type SuggestedQuestionChange,
  type SuggestedQuestionScope,
  type SuggestedQuestionStore,
} from "@overview/domain";
import { createFetchChatApi } from "@overview/sync";
import type { Analytics } from "../analytics/createAnalytics.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useOverviewsWithStateQuery } from "../overviews/queries/overviewsWithStateQuery.js";
import { isConnected } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useStores } from "../../stores/StoresContext.js";
import { chatKeys } from "./chatKeys.js";
import { useChatUsageQuery } from "./queries/chatUsageQuery.js";
import { suggestedQuestionScopeOf, useSuggestedQuestionsQuery } from "./queries/suggestedQuestionsQuery.js";
import type { AskQuestion, AskQuestionOverview, CustomAskQuestion } from "./types/AskQuestion.js";
import { askQuestionPage, askQuestionSet, customAskQuestions, nextAskQuestionPage } from "./util/askQuestionSet.js";

export const UNDO_QUESTION_MS = 5000;

export type QuestionRemoval = "notUseful" | "hidden";

export interface HeldRemoval {
  question: CustomAskQuestion;
  action: QuestionRemoval;
}

export interface AskedQuestion {
  text: string;
  pinnedOverviews: OverviewId[];
}

export interface SuggestedQuestionsDeps {
  scope: SuggestedQuestionScope;
  plan: Plan | null;
  signedIn: boolean;
  questions: readonly SuggestedQuestion[] | undefined;
  templates: readonly string[];
  overviewOf: ((id: OverviewId) => AskQuestionOverview | null) | null;
  showing: boolean;
  store: Pick<SuggestedQuestionStore, "changeSuggestedQuestion">;
  refresh: ((scope: SuggestedQuestionScope) => Promise<unknown>) | null;
  analytics: Analytics;
  onChanged: () => void;
  now?: () => Date;
}

interface Held extends HeldRemoval {
  change: SuggestedQuestionChange;
}

interface GladMark {
  glad: boolean;
  at: string;
}

const scopeKeyOf = (scope: SuggestedQuestionScope): string => (scope.kind === "library" ? "library" : `project:${scope.projectId}`);

const paidPlan = (plan: Plan | null): boolean => plan !== null && plan !== "free";

const systemNow = () => new Date();

// Questions arrive through sync, so what the refresh says only matters to the server's logs.
export const refreshQuietly = (refresh: (scope: SuggestedQuestionScope) => Promise<unknown>, scope: SuggestedQuestionScope): void => {
  void Promise.resolve()
    .then(() => refresh(scope))
    .catch(() => undefined);
};

// The set, the cycling and the held write: docs/features/suggested-questions.md, "Slice 3: on the Ask page".
export const useSuggestedQuestionsWith = ({
  scope,
  plan,
  signedIn,
  questions,
  templates,
  overviewOf,
  showing,
  store,
  refresh,
  analytics,
  onChanged,
  now = systemNow,
}: SuggestedQuestionsDeps) => {
  const scopeKey = scopeKeyOf(scope);
  const askScope = scope.kind;
  const eventPlan: Plan = plan ?? "free";
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState<Held | null>(null);
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [marks, setMarks] = useState<Readonly<Record<string, GladMark>>>({});
  const shownRecorded = useRef(new Set<string>());
  const lastShownSet = useRef<string | null>(null);
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [scopeKey]);

  useEffect(() => {
    if (!signedIn || refresh === null || plan === "free" || refreshedFor.current === scopeKey) {
      return;
    }
    refreshedFor.current = scopeKey;
    refreshQuietly(refresh, scope);
  }, [signedIn, refresh, plan, scopeKey]);

  const ready = plan !== null && (plan === "free" || (questions !== undefined && overviewOf !== null));
  const goodOf = useCallback(
    (question: SuggestedQuestion): boolean => {
      const mark = marks[question.id];
      if (mark !== undefined && (question.feedback === null || mark.at >= question.feedback.at)) {
        return mark.glad;
      }
      return question.feedback?.verdict === "glad";
    },
    [marks],
  );

  const custom = useMemo(() => {
    if (!paidPlan(plan) || questions === undefined || overviewOf === null) {
      return [];
    }
    const removed = new Set(gone);
    if (held !== null) {
      removed.add(held.question.id);
    }
    return customAskQuestions(questions, { overviewOf, removed, goodOf });
  }, [plan, questions, overviewOf, gone, held, goodOf]);

  const set: AskQuestion[] = useMemo(() => askQuestionSet(custom, templates), [custom, templates]);
  const shown = askQuestionPage(set, page);
  const shownKey = shown.questions.map((question) => question.id).join("\n");

  const write = useCallback(
    (id: string, change: SuggestedQuestionChange) => {
      void store.changeSuggestedQuestion(id, change).then(onChanged, (error: unknown) => console.error(error));
    },
    [store, onChanged],
  );

  useEffect(() => {
    if (!showing || !ready || shown.questions.length === 0) {
      lastShownSet.current = null;
      return;
    }
    const at = now().toISOString();
    const unrecorded = shown.questions.filter(
      (question) =>
        question.kind === "custom" &&
        !shownRecorded.current.has(question.id) &&
        questions?.find((each) => each.id === question.id)?.shownAt === null,
    );
    for (const question of unrecorded) {
      shownRecorded.current.add(question.id);
      write(question.id, { shownAt: at });
    }
    if (lastShownSet.current !== shownKey) {
      lastShownSet.current = shownKey;
      analytics.ask.questions.shown({
        plan: eventPlan,
        scope: askScope,
        custom: shown.questions.filter((question) => question.kind === "custom").length,
      });
    }
  }, [showing, ready, shownKey]);

  const commit = useCallback(
    (removal: Held) => {
      setGone((current) => new Set(current).add(removal.question.id));
      write(removal.question.id, removal.change);
      if (removal.action === "hidden") {
        analytics.ask.question.dismissed({ plan: eventPlan, scope: askScope });
      } else {
        analytics.ask.question.markedObvious({ plan: eventPlan, scope: askScope });
      }
    },
    [write, analytics, eventPlan, askScope],
  );

  const stillHeld = useRef<Held | null>(null);
  const commitLater = useRef(commit);
  stillHeld.current = held;
  commitLater.current = commit;

  const flush = useCallback(() => {
    const pending = stillHeld.current;
    if (pending === null) {
      return;
    }
    stillHeld.current = null;
    commitLater.current(pending);
    setHeld(null);
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      const pending = stillHeld.current;
      if (pending !== null) {
        stillHeld.current = null;
        commitLater.current(pending);
      }
    };
  }, [flush]);

  useEffect(() => {
    if (held === null) {
      return;
    }
    const timer = setTimeout(flush, UNDO_QUESTION_MS);
    return () => clearTimeout(timer);
  }, [held, flush]);

  const remove = (question: CustomAskQuestion, action: QuestionRemoval) => {
    flush();
    const at = now().toISOString();
    const change: SuggestedQuestionChange = action === "hidden" ? { dismissedAt: at } : { feedback: { verdict: "obvious", at } };
    const next = { question, action, change };
    stillHeld.current = next;
    setHeld(next);
  };

  const notUseful = (question: CustomAskQuestion) => remove(question, "notUseful");
  const hide = (question: CustomAskQuestion) => remove(question, "hidden");

  const undo = () => {
    const pending = stillHeld.current;
    if (pending === null) {
      return;
    }
    stillHeld.current = null;
    setHeld(null);
    analytics.ask.question.undone({ plan: eventPlan, scope: askScope, action: pending.action });
  };

  const toggleGood = (question: CustomAskQuestion) => {
    const glad = !question.good;
    const at = now().toISOString();
    setMarks((current) => ({ ...current, [question.id]: { glad, at } }));
    write(question.id, { feedback: { verdict: glad ? "glad" : "none", at } });
    analytics.ask.question.markedGlad({ plan: eventPlan, scope: askScope, glad });
  };

  const ask = (question: AskQuestion): AskedQuestion => {
    analytics.ask.question.asked({ plan: eventPlan, scope: askScope, kind: question.kind });
    if (question.kind === "template") {
      return { text: question.text, pinnedOverviews: [] };
    }
    write(question.id, { askedAt: now().toISOString() });
    return { text: question.text, pinnedOverviews: question.overviews.map((overview) => overview.id) };
  };

  const next = () => {
    analytics.ask.questions.differentPressed({ plan: eventPlan, scope: askScope });
    setPage(nextAskQuestionPage(shown));
  };

  const chipOpened = () => analytics.ask.question.chipOpened({ plan: eventPlan, scope: askScope });

  return {
    questions: shown.questions,
    page: shown.page,
    pages: shown.pages,
    total: set.length,
    canCycle: shown.canCycle,
    held: held === null ? null : { question: held.question, action: held.action },
    next,
    toggleGood,
    notUseful,
    hide,
    undo,
    ask,
    chipOpened,
  };
};

const questionOverviewsOf = (entries: ReturnType<typeof useOverviewsWithStateQuery>["data"]) => {
  if (entries === undefined) {
    return null;
  }
  const byId = new Map<string, AskQuestionOverview>();
  for (const entry of entries) {
    if (entry.kind === "overview") {
      const { overview } = entry;
      byId.set(overview.id, {
        id: overview.id,
        title: overview.source.title,
        kind: chatSourceKind(overview),
        imageUrl: sourceImage(overview.source),
        wide: overview.source.kind === "youtube",
      });
    }
  }
  return (id: OverviewId) => byId.get(id) ?? null;
};

export interface SuggestedQuestionsOptions {
  projectId: ProjectId | null;
  templates: readonly string[];
  showing: boolean;
}

export const useSuggestedQuestions = ({ projectId, templates, showing }: SuggestedQuestionsOptions) => {
  const { suggestedQuestionStore } = useStores();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const plan = useChatUsageQuery().data?.plan ?? null;
  const questions = useSuggestedQuestionsQuery(projectId).data;
  const library = useOverviewsWithStateQuery().data;
  const overviewOf = useMemo(() => questionOverviewsOf(library), [library]);
  const scope = useMemo(() => suggestedQuestionScopeOf(projectId), [projectId]);
  const refresh = useMemo(
    () =>
      apiUrl === null
        ? null
        : (asked: SuggestedQuestionScope) =>
            createFetchChatApi({ baseUrl: apiUrl, token: connection.token }).refreshSuggestedQuestions(asked),
    [apiUrl, connection.token],
  );
  const onChanged = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: chatKeys.suggested(projectId) }),
    [queryClient, projectId],
  );
  return useSuggestedQuestionsWith({
    scope,
    plan,
    signedIn: isConnected(connection),
    questions,
    templates,
    overviewOf,
    showing,
    store: suggestedQuestionStore,
    refresh,
    analytics,
    onChanged,
  });
};
