import { createHash } from "node:crypto";
import { z } from "zod";
import type { Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch, type MeteredCall } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparedModelName, parseComparedModel, type ComparedModel } from "./ComparedModel.js";
import { JUDGES } from "./judgePair.js";
import { transcriptForJudging } from "./judgeRubric.js";
import type { JudgeOutcome } from "./JudgeRecord.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";

const ActionLabels = z.object({
  id: z.string(),
  reason: z.string(),
  concrete: z.enum(["concrete", "principle"]),
  grounding: z.enum(["from-video", "sensible-extension", "contradicts-video"]),
  fit: z.enum(["fits", "generic", "misreads", "no-reader"]),
  doable: z.enum(["doable", "not-doable"]),
  helpful: z.enum(["helpful", "marginal", "unhelpful"]),
});
export type ActionLabels = z.infer<typeof ActionLabels>;

const EmptyLabels = z.object({ reader: z.string(), reason: z.string(), verdict: z.enum(["right", "missed"]) });

export const ActionJudgeAnswer = z.object({ actions: z.array(ActionLabels), empty: z.array(EmptyLabels) });
export type ActionJudgeAnswer = z.infer<typeof ActionJudgeAnswer>;

export interface JudgedAction extends Omit<ActionLabels, "id"> {
  reader: string;
  action: string;
}

export interface ActionJudgeRecord {
  videoId: string;
  judge: string;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  actions: JudgedAction[];
  empty: { reader: string; verdict: "right" | "missed"; reason: string }[];
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}

export interface ReaderActions {
  name: string;
  readerContext: string | null;
  actions: readonly string[];
}

const SYSTEM_PROMPT = `You judge the "How to apply" actions written for several readers of one YouTube video:
things the reader could go and do after watching. You are given the video's transcript and,
for each reader, what is known about them and the actions written for them. The readers'
order and numbers mean nothing.

Every reader chose to save this video, so take their interest in its subject as given, even
where what we know of them doesn't mention it: a nurse who saved a video about finding app
ideas wants to find one. Judge whether the actions serve that interest, and whether they use
what we know of the reader well.

Label every action on each of these, giving a one-sentence reason first:

- concrete: "concrete" when it says what to do, specifically enough to start ("Do a 10 minute
  phone-free wind-down before bed on school nights"); "principle" when it is advice in general
  ("Prioritise connection").
- grounding: "from-video" when it comes straight from what the video teaches;
  "sensible-extension" when it adds a step, schedule or number the video doesn't give but
  sensibly applies what it teaches, which is wanted, not a fault; "contradicts-video" when it
  misrepresents or goes against what the video teaches.
- fit: for a reader we know about, "fits" when it is shaped by what we know of them and the
  shaping is right; "generic" when it would read the same for anyone; "misreads" when it uses
  what we know of them wrongly, assuming something untrue or forcing a detail where it doesn't
  belong. For a reader we know nothing about, always "no-reader".
- doable: "doable" when this reader could realistically do it within the next couple of weeks,
  at a reasonable cost in time and money; "not-doable" otherwise.
- helpful: "helpful" when doing it would leave this reader better off in a way they'd notice;
  "marginal" when it is harmless but makes little difference; "unhelpful" when it wastes their
  time or could do harm.

Label every action exactly once, by its id. For each reader given no actions, say whether that
was "right", because the video offers this reader nothing worth doing, or "missed", because it
does.`;

const readerLabel = (index: number) => `Reader ${index + 1}`;

// Shuffled per video by a hash, so no reader is always first and a rerun shows the same order.
export const blindOrder = (videoId: string, readers: readonly ReaderActions[]): ReaderActions[] =>
  [...readers].sort((left, right) => {
    const key = (name: string) => createHash("sha256").update(`${videoId}\n${name}`).digest("hex");
    return key(left.name).localeCompare(key(right.name));
  });

export function actionJudgePrompt(fetched: FetchedTranscript, readers: readonly ReaderActions[]) {
  const blocks = readers.map((reader, index) =>
    [
      `=== ${readerLabel(index)} ===`,
      reader.readerContext === null ? "Nothing is known about this reader." : `About this reader: ${reader.readerContext}`,
      ...(reader.actions.length === 0
        ? ["Actions: none"]
        : ["Actions:", ...reader.actions.map((action, item) => `${index + 1}.${item + 1} ${action}`)]),
    ].join("\n"),
  );
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `${transcriptForJudging(fetched)}\n\n${blocks.join("\n\n")}`,
    schema: ActionJudgeAnswer,
  };
}

// Every action labelled exactly once and every empty reader answered, or the answer is a
// failure: a count that skipped some actions would read as a rate over all of them.
export function resolveAnswer(readers: readonly ReaderActions[], answer: ActionJudgeAnswer): Pick<ActionJudgeRecord, "actions" | "empty"> {
  const wanted = new Map<string, { reader: ReaderActions; action: string }>(
    readers.flatMap((reader, index) => reader.actions.map((action, item) => [`${index + 1}.${item + 1}`, { reader, action }] as const)),
  );
  const ids = answer.actions.map((labels) => labels.id.trim());
  const missing = [...wanted.keys()].filter((id) => !ids.includes(id));
  if (missing.length > 0 || ids.length !== wanted.size || new Set(ids).size !== ids.length) {
    throw new JudgeAnswerError(`labelled ${ids.join(", ")}; wanted each of ${[...wanted.keys()].join(", ")} once`);
  }
  const emptyReaders = readers.flatMap((reader, index) => (reader.actions.length === 0 ? [[readerLabel(index), reader] as const] : []));
  const empty = emptyReaders.map(([label, reader]) => {
    const found = answer.empty.find((entry) => entry.reader.trim() === label);
    if (found === undefined) throw new JudgeAnswerError(`no verdict for ${label}, given no actions`);
    return { reader: reader.name, verdict: found.verdict, reason: found.reason };
  });
  return {
    actions: answer.actions.map(({ id, ...labels }) => {
      const { reader, action } = wanted.get(id.trim())!;
      return { ...labels, fit: reader.readerContext === null ? "no-reader" : labels.fit, reader: reader.name, action };
    }),
    empty,
  };
}

export class JudgeAnswerError extends Error {
  override name = "JudgeAnswerError";
}

export function actionJudgeFor(writer: ComparedModel, chosen: ComparedModel | null = null): ComparedModel {
  if (chosen !== null && chosen.provider === writer.provider)
    throw new Error(`a judge from ${writer.provider} would be judging its own provider's actions`);
  const judge = chosen ?? JUDGES.map(parseComparedModel).find((model) => model.provider !== writer.provider);
  if (judge === undefined) throw new Error(`no judge outside ${writer.provider}`);
  return judge;
}

export interface JudgeActionsOptions {
  fetched: FetchedTranscript;
  readers: readonly ReaderActions[];
  writer: ComparedModel;
  judge?: ComparedModel | null;
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

export async function judgeActions({
  fetched,
  readers,
  writer,
  judge: chosen = null,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgeActionsOptions): Promise<ActionJudgeRecord> {
  const videoId = fetched.video.id ?? fetched.video.url;
  const judge = actionJudgeFor(writer, chosen);
  const ordered = blindOrder(videoId, readers);
  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });

  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let resolved: Pick<ActionJudgeRecord, "actions" | "empty"> = { actions: [], empty: [] };
  try {
    const parsed = ActionJudgeAnswer.safeParse(await client(actionJudgePrompt(fetched, ordered)));
    if (!parsed.success) throw new JudgeAnswerError(`the judge's answer broke its schema: ${parsed.error.message}`);
    resolved = resolveAnswer(ordered, parsed.data);
  } catch (thrown) {
    outcome = thrown instanceof JudgeAnswerError || isTheModelsDoing(thrown) ? "failed" : "errored";
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }

  return {
    videoId,
    judge: comparedModelName(judge),
    judgedAt: new Date().toISOString(),
    outcome,
    error,
    ...resolved,
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
