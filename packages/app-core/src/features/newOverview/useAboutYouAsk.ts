import { useCallback, useRef, useState } from "react";
import { aboutYouIsEmpty, aboutYouPatch, type AboutYou, type AboutYouSkip, type CaptureEntry, type Settings } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { usePlan } from "../plus/usePlan.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { typedEntryCount } from "../settings/util/aboutYouCopy.js";
import { useStores } from "../../stores/StoresContext.js";
import type { AboutToWrite } from "./api/generationPipeline.js";
import { aboutYouAskDue, asksAboutYouBefore } from "./util/asksAboutYouBefore.js";

export type AboutYouAskState = "waiting" | "filled" | "skipped";

export interface AboutYouAsking {
  from: CaptureEntry;
  sourceKind: AboutToWrite["kind"];
}

export interface AboutYouAsk {
  asking: AboutYouAsking | null;
  saving: boolean;
  continueWith: (answer: AboutYou, topicNames: readonly string[]) => Promise<void>;
  skip: (how: AboutYouSkip) => Promise<void>;
  // A surface able to show the ask holds it while mounted; with none, no run waits on it.
  host: () => () => void;
}

export interface AboutYouAskGate {
  beforeWriting: (
    from: CaptureEntry,
    canAsk: () => boolean,
    onState: (state: AboutYouAskState) => void,
  ) => (about: AboutToWrite) => Promise<boolean>;
  // The run stopped while asked: it goes on, unanswered, and is asked again at the next save.
  letGo: () => void;
}

// docs/features/personalisation.md, "Asked once more".
export const useAboutYouAsk = (): AboutYouAsk & AboutYouAskGate => {
  const { settingsStore } = useStores();
  const updateSettings = useUpdateSettingsMutation();
  const analytics = useAnalytics();
  const { plan } = usePlan();
  const [asking, setAsking] = useState<AboutYouAsking | null>(null);
  const [saving, setSaving] = useState(false);
  const answeredRef = useRef<((state: AboutYouAskState | null) => void) | null>(null);
  const hostsRef = useRef(0);

  const letGo = useCallback((state: AboutYouAskState | null = null) => {
    answeredRef.current?.(state);
    answeredRef.current = null;
    setAsking(null);
  }, []);

  const beforeWriting = useCallback(
    (from: CaptureEntry, canAsk: () => boolean, onState: (state: AboutYouAskState) => void) =>
      async (about: AboutToWrite): Promise<boolean> => {
        const able = () => canAsk() && hostsRef.current > 0 && answeredRef.current === null;
        if (!able() || !aboutYouAskDue(await settingsStore.get()) || !(await asksAboutYouBefore(about)) || !able()) {
          return false;
        }
        analytics.capture.aboutYouAsk.shown({ plan, from, sourceKind: about.kind });
        onState("waiting");
        const state = await new Promise<AboutYouAskState | null>((resolve) => {
          answeredRef.current = resolve;
          setAsking({ from, sourceKind: about.kind });
        });
        if (state !== null) {
          onState(state);
        }
        return true;
      },
    [settingsStore, analytics, plan],
  );

  const answer = useCallback(
    async (patch: Partial<Settings>, state: AboutYouAskState) => {
      setSaving(true);
      try {
        await updateSettings.mutateAsync({ ...patch, aboutYouAskedAfterOnboarding: true });
      } finally {
        setSaving(false);
        letGo(state);
      }
    },
    [updateSettings, letGo],
  );

  const continueWith = useCallback(
    async (aboutYou: AboutYou, topicNames: readonly string[]) => {
      if (asking === null) {
        return;
      }
      analytics.capture.aboutYouAsk.continued({
        plan,
        ...asking,
        who: aboutYou.who.length,
        time: aboutYou.time.length,
        focus: aboutYou.focus.length,
        typed: typedEntryCount(aboutYou, topicNames),
      });
      await answer(aboutYouPatch(aboutYou), aboutYouIsEmpty(aboutYou) ? "skipped" : "filled");
    },
    [asking, analytics, plan, answer],
  );

  const skip = useCallback(
    async (how: AboutYouSkip) => {
      if (asking === null) {
        return;
      }
      analytics.capture.aboutYouAsk.skipped({ plan, ...asking, how });
      await answer({}, "skipped");
    },
    [asking, analytics, plan, answer],
  );

  const host = useCallback(() => {
    hostsRef.current += 1;
    return () => {
      hostsRef.current -= 1;
    };
  }, []);

  return { asking, saving, continueWith, skip, host, beforeWriting, letGo };
};
