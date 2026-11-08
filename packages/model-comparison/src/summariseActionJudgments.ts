import type { ActionJudgeRecord, JudgedAction } from "./judgeActions.js";

export interface ActionJudgmentSummary {
  reader: string;
  videos: number;
  actions: number;
  concrete: number;
  sensibleExtension: number;
  contradicts: number;
  fits: number;
  generic: number;
  misreads: number;
  doable: number;
  helpful: number;
  marginal: number;
  unhelpful: number;
  practicalAndHelpful: number;
  emptyRight: number;
  emptyMissed: number;
}

// The one number the owner asked for: something a reader can start on, true to the video,
// not wrong about them, within reach, and worth doing.
export const isPracticalAndHelpful = (action: JudgedAction): boolean =>
  action.concrete === "concrete" &&
  action.grounding !== "contradicts-video" &&
  action.fit !== "misreads" &&
  action.doable === "doable" &&
  action.helpful === "helpful";

export function summariseActionJudgments(readers: readonly string[], records: readonly ActionJudgeRecord[]): ActionJudgmentSummary[] {
  const judged = records.filter((record) => record.outcome === "judged");
  return readers.map((reader) => {
    const actions = judged.flatMap((record) => record.actions.filter((action) => action.reader === reader));
    const empty = judged.flatMap((record) => record.empty.filter((entry) => entry.reader === reader));
    const count = (test: (action: JudgedAction) => boolean) => actions.filter(test).length;
    return {
      reader,
      videos: judged.length,
      actions: actions.length,
      concrete: count((action) => action.concrete === "concrete"),
      sensibleExtension: count((action) => action.grounding === "sensible-extension"),
      contradicts: count((action) => action.grounding === "contradicts-video"),
      fits: count((action) => action.fit === "fits"),
      generic: count((action) => action.fit === "generic"),
      misreads: count((action) => action.fit === "misreads"),
      doable: count((action) => action.doable === "doable"),
      helpful: count((action) => action.helpful === "helpful"),
      marginal: count((action) => action.helpful === "marginal"),
      unhelpful: count((action) => action.helpful === "unhelpful"),
      practicalAndHelpful: count(isPracticalAndHelpful),
      emptyRight: empty.filter((entry) => entry.verdict === "right").length,
      emptyMissed: empty.filter((entry) => entry.verdict === "missed").length,
    };
  });
}
