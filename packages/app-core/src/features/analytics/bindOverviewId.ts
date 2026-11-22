import type { OverviewId, OverviewPageEvents } from "@overview/domain";
import type { Analytics, EventMethod } from "./createAnalytics.js";

type WithoutOverviewId<Method> = Method extends (props: infer P) => void
  ? keyof Omit<P, "overviewId"> extends never
    ? () => void
    : (props: Omit<P, "overviewId">) => void
  : never;

export type ReaderAnalytics = {
  [S in keyof Analytics["reader"]]: {
    [A in keyof Analytics["reader"][S]]: WithoutOverviewId<Analytics["reader"][S][A]>;
  };
};

export type OverviewPageAnalytics = {
  [S in keyof OverviewPageEvents]: {
    [A in keyof OverviewPageEvents[S]]: EventMethod<OverviewPageEvents[S][A]>;
  };
};

export const bindOverviewId = (reader: Analytics["reader"], overviewId: OverviewId): ReaderAnalytics => {
  return Object.fromEntries(
    Object.entries(reader).map(([screen, actions]) => [
      screen,
      Object.fromEntries(
        Object.entries(actions as Record<string, (props: object) => void>).map(([action, send]) => [
          action,
          (props: object = {}) => send({ ...props, overviewId }),
        ]),
      ),
    ]),
  ) as ReaderAnalytics;
};
