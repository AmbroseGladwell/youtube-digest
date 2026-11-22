import { createContext, useContext } from "react";
import type { LibraryMove } from "./types/LibraryMove.js";

export interface LibraryMoveState {
  move: LibraryMove | null;
  dismiss: () => void;
  // Set once onboarding's answers are in the account, so what depends on them can wait for them.
  answersIn: string | null;
}

const LibraryMoveContext = createContext<LibraryMoveState>({
  move: null,
  dismiss: () => undefined,
  answersIn: null,
});

export const LibraryMoveProvider = LibraryMoveContext.Provider;

export const useLibraryMove = (): LibraryMoveState => {
  return useContext(LibraryMoveContext);
};
