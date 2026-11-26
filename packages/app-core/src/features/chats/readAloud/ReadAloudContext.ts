import { createContext, useContext, useSyncExternalStore } from "react";
import type { ReadAloudEngine, ReadAloudSnapshot } from "./ReadAloudEngine.js";

const ReadAloudContext = createContext<ReadAloudEngine | null>(null);

export const ReadAloudProvider = ReadAloudContext.Provider;

export const useReadAloud = (): ReadAloudEngine | null => useContext(ReadAloudContext);

const IDLE_SUBSCRIBE = () => () => undefined;
const NO_SNAPSHOT = (): null => null;

export const useReadAloudSnapshot = (): ReadAloudSnapshot | null => {
  const engine = useReadAloud();
  return useSyncExternalStore(engine?.subscribe ?? IDLE_SUBSCRIBE, engine?.getSnapshot ?? NO_SNAPSHOT);
};
