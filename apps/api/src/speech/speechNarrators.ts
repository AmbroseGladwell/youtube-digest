import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, redactErrorMessage } from "@overview/domain";
import type { Narrator } from "../audio/Narrator.js";
import type { AudioSetup } from "../buildApp.js";
import type { SqlClient } from "../db/SqlClient.js";
import { createFallbackNarrator } from "./fallbackNarrator.js";
import { ModalSpendGuard } from "./ModalSpendGuard.js";

// A cold T4 answers in 6–9 s (OV-421), so chat waits that long; a render is in no hurry.
export const CHAT_FIRST_LINE_MS = 10_000;
export const RENDER_FIRST_LINE_MS = 30_000;

export interface SpeechNarrators {
  chat: Narrator;
  renders: Narrator;
}

export interface SpeechNarratorsOptions {
  audio: AudioSetup;
  sql: SqlClient;
  clock: () => Date;
  log: FastifyBaseLogger;
}

// Modal first for chat and for narration, the Fly pool behind both: docs/features/tts-pre-rendered-speech.md, "On Modal (OV-423)".
export const speechNarrators = ({ audio, sql, clock, log }: SpeechNarratorsOptions): SpeechNarrators => {
  const modal = audio.modal ?? null;
  if (modal === null) {
    return { chat: audio.narrator, renders: audio.narrator };
  }
  const guard = new ModalSpendGuard({
    sql,
    monthlyDollars: modal.monthlyDollars,
    clock,
    onClosed: () => log.warn(apiLogLines.speech.modalClosed({ limitSet: true })),
  });
  const behind = (lane: "chat" | "renders", firstLineMs: number) =>
    createFallbackNarrator({
      primary: modal.narrator,
      fallback: audio.narrator,
      firstLineMs,
      primaryOpen: guard.open,
      onFallback: ({ requestId, reason, error }) =>
        log.warn(
          apiLogLines.speech.fellBack({
            lane,
            reason,
            ttsRequestId: requestId,
            ...(error === undefined ? {} : { error: redactErrorMessage(error) }),
          }),
        ),
    });
  return { chat: behind("chat", CHAT_FIRST_LINE_MS), renders: behind("renders", RENDER_FIRST_LINE_MS) };
};
