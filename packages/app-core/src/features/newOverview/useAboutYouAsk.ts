import { useCallback, useRef, useState } from "react";
import { aboutYouPatch, type AboutYou, type CaptureEntry, type Settings } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { usePlan } from "../plus/usePlan.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { typedEntryCount } from "../settings/util/aboutYouCopy.js";
import { useStores } from "../../stores/StoresContext.js";
import type { AboutToWrite } from "./api/generationPipeline.js";
import { aboutYouAskDue, asksAboutYouBefore } from "./util/asksAboutYouBefore.js";

export interface AboutYouAsking {
  from: CaptureEntry;
  sourceKind: AboutToWrite["kind"];
}

export interface AboutYouAsk {
  asking: AboutYouAsking | null;
  saving: boolean;
  continueWith: (answer: AboutYou, topicNames: readonly string[]) => Promise<void>;
  skip: (how: "skip" | "closed") => Promise<void>;
  // A surface able to show the ask holds it while mounted; with none, no run waits on it.
  host: () => () => void;
}

export interface AboutYouAskGate {
  beforeWriting: (from: CaptureEntry, canAsk: () => boolean) => (about: AboutToWrite) => Promise<boolean>;
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
  const answeredRef = useRef<(() => void) | null>(null);
  const hostsRef = useRef(0);

  const letGo = useCallback(() => {
    answeredRef.current?.();
    answeredRef.current = null;
    setAsking(null);
  }, []);

  const beforeWriting = useCallback(
    (from: CaptureEntry, canAsk: () => boolean) =>
      async (about: AboutToWrite): Promise<boolean> => {
        const able = () => canAsk() && hostsRef.current > 0 && answeredRef.current === null;
        if (!able() || !aboutYouAskDue(await settingsStore.get()) || !(await asksAboutYouBefore(about)) || !able()) {
          return false;
        }
        analytics.capture.aboutYouAsk.shown({ plan, from, sourceKind: about.kind });
        await new Promise<void>((resolve) => {
          answeredRef.current = resolve;
          setAsking({ from, sourceKind: about.kind });
        });
        return true;
      },
    [settingsStore, analytics, plan],
  );

  const answer = useCallback(
    async (patch: Partial<Settings>) => {
      setSaving(true);
      try {
        await updateSettings.mutateAsync({ ...patch, aboutYouAskedAfterOnboarding: true });
      } finally {
        setSaving(false);
        letGo();
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
      await answer(aboutYouPatch(aboutYou));
    },
    [asking, analytics, plan, answer],
  );

  const skip = useCallback(
    async (how: "skip" | "closed") => {
      if (asking === null) {
        return;
      }
      analytics.capture.aboutYouAsk.skipped({ plan, ...asking, how });
      await answer({});
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
