import { createContext, useContext } from "react";
import type { LibraryMove } from "./types/LibraryMove.js";

export interface LibraryMoveState {
  // What the move on sign-in did, until the reader has been told (design 47e).
  move: LibraryMove | null;
  dismiss: () => void;
}

const LibraryMoveContext = createContext<LibraryMoveState>({ move: null, dismiss: () => undefined });

export const LibraryMoveProvider = LibraryMoveContext.Provider;

export function useLibraryMove(): LibraryMoveState {
  return useContext(LibraryMoveContext);
}
