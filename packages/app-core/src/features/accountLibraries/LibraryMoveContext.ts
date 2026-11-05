import { createContext, useContext } from "react";
import type { LibraryMove } from "./types/LibraryMove.js";

export interface LibraryMoveState {
  // What the move on sign-in did, until the reader has been told (design 47e).
  move: LibraryMove | null;
  dismiss: () => void;
  // The account this device's answers (topics, About you, the voice) have been moved into, so
  // what depends on them, like sorting a sample, can wait for them.
  answersIn: string | null;
}

const LibraryMoveContext = createContext<LibraryMoveState>({ move: null, dismiss: () => undefined, answersIn: null });

export const LibraryMoveProvider = LibraryMoveContext.Provider;

export function useLibraryMove(): LibraryMoveState {
  return useContext(LibraryMoveContext);
}
