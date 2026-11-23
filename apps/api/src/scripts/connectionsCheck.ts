import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  composeReaderContext,
  FOLLOW_UP_QUESTION_MAX_WORDS,
  FOLLOW_UP_QUESTION_TARGET_WORDS,
  Overview,
  OVERVIEW_MIGRATIONS,
  Project,
  PROJECT_MIGRATIONS,
  readStoredRecord,
  Settings,
  SETTINGS_MIGRATIONS,
  stampSchemaVersion,
} from "@overview/domain";
import { costInDollars, priceOf, tokenUsageOf, type TokenUsage } from "@overview/generation";
import { z } from "zod";

// docs/features/connections.md, "How it was measured".

const LABELLER = { provider: "openai", model: "gpt-6-luna" } as const;
const JUDGE = { provider: "anthropic", model: "claude-sonnet-5-5" } as const;
const PARTNERS_PER_OVERVIEW = 3;
const SAMPLE_SEED = 218;

type ClaimField = "bigPicture" | "coreClaim" | "keyPoint" | "recipe";

interface Claim {
  id: string;
  field: ClaimField;
  text: string;
  vector: Float32Array;
}

interface Entry {
  overview: Overview;
  title: string;
  claims: Claim[];
}

interface Candidate {
  key: string;
  a: string;
  b: string;
  origin: "embedding" | "similarTo" | "both";
  rank: number | null;
  score: number;
  bigPictureScore: number;
  aClaim: string;
  bClaim: string;
  wordOverlap: number;
  sharedTopic: boolean;
}

const RELATIONS = ["same_claim", "builds_on", "contradicts", "shared_idea", "same_topic_only", "unrelated"] as const;
const CONNECTED = new Set<string>(["same_claim", "builds_on", "contradicts", "shared_idea"]);

const Label = z.object({
  relation: z.enum(RELATIONS),
  reason: z.string(),
  aPoints: z.array(z.string()),
  bPoints: z.array(z.string()),
});
type Label = z.infer<typeof Label>;

const Judgment = z.object({
  relation: z.enum(RELATIONS),
  verdict: z.enum(["real", "stretch", "not_connected"]),
  worthShowing: z.boolean(),
  why: z.string(),
});
type Judgment = z.infer<typeof Judgment>;

const ReasonCheck = z.object({ trueToBoth: z.boolean(), specific: z.boolean(), problem: z.string() });
type ReasonCheck = z.infer<typeof ReasonCheck>;

interface Priced {
  costDollars: number;
  usage: TokenUsage | null;
}

const StrictLabel = z.object({
  relation: z.enum(RELATIONS),
  verdict: z.enum(["real", "stretch", "not_connected"]),
  reason: z.string(),
});
type StrictLabel = z.infer<typeof StrictLabel>;

interface Results {
  labels: Record<string, Label & Priced>;
  judgments: Record<string, Judgment & Priced>;
  reasonChecks: Record<string, ReasonCheck & Priced>;
  strictLabels?: Record<string, StrictLabel & Priced>;
  strictReasonChecks?: Record<string, ReasonCheck & Priced>;
}

const fieldsOf = (overview: Overview): Array<{ field: ClaimField; text: string; id: string }> =>
  [
    { field: "bigPicture" as const, text: overview.bigPicture ?? "", id: "bp" },
    { field: "coreClaim" as const, text: overview.coreClaim, id: "core" },
    ...overview.keyPoints.map((point, index) => ({ field: "keyPoint" as const, text: point.text, id: `kp${index + 1}` })),
    { field: "recipe" as const, text: overview.recipe?.summary ?? "", id: "recipe" },
  ]
    .map((claim) => ({ ...claim, text: claim.text.trim() }))
    .filter((claim) => claim.text !== "");

const parseVector = (text: string): Float32Array => {
  const values = text.slice(1, -1).split(",").map(Number);
  const vector = Float32Array.from(values);
  const norm = Math.hypot(...vector);
  return vector.map((value) => value / norm);
};

const dot = (left: Float32Array, right: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < left.length; i++) {
    sum += left[i]! * right[i]!;
  }
  return sum;
};

const loadLibrary = async (dataDir: string): Promise<Map<string, Entry>> => {
  const raw = JSON.parse(await readFile(join(dataDir, "library", "library.json"), "utf-8")) as {
    overviews: Array<{ id: string; schemaVersion: number; body: unknown }>;
    embeddings: Array<{ overviewId: string; claims: Array<{ position: number; embedding: string }> }>;
  };
  const vectors = new Map(raw.embeddings.map((row) => [row.overviewId, row.claims]));
  const entries = new Map<string, Entry>();
  for (const row of raw.overviews) {
    const read = readStoredRecord(
      stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion),
      Overview,
      OVERVIEW_MIGRATIONS,
    );
    if (read.status !== "read") {
      throw new Error(`overview ${row.id} did not read: ${read.status}`);
    }
    const overview = read.record;
    const fields = fieldsOf(overview);
    const stored = vectors.get(overview.id) ?? [];
    if (stored.length !== fields.length) {
      console.error(`skipped ${overview.id}: ${stored.length} vectors for ${fields.length} claims`);
      continue;
    }
    entries.set(overview.id, {
      overview,
      title: overview.source.title,
      claims: fields.map((field, index) => ({
        ...field,
        vector: parseVector(stored.find((claim) => claim.position === index)!.embedding),
      })),
    });
  }
  return entries;
};

const STOPWORDS = new Set(
  "a an the and or but if of to in on for with by from at as is are was were be been being it its this that these those you your they their them we our i he she his her not no do does did can could should would will just than then so such more most less very into over under about up out what which who when where why how all any each other some only own same too".split(
    " ",
  ),
);
const wordsOf = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
      .map((word) => word.replace(/(ing|ed|es|s)$/, "")),
  );
const wordOverlapOf = (left: string, right: string): number => {
  const a = wordsOf(left);
  const b = wordsOf(right);
  const shared = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
};

const pairKey = (left: string, right: string) => (left < right ? `${left}|${right}` : `${right}|${left}`);

const bestPair = (left: Entry, right: Entry, fields: ReadonlySet<ClaimField>) => {
  let best = { score: -1, a: "", b: "" };
  for (const a of left.claims) {
    if (!fields.has(a.field)) {
      continue;
    }
    for (const b of right.claims) {
      if (!fields.has(b.field)) {
        continue;
      }
      const score = dot(a.vector, b.vector);
      if (score > best.score) {
        best = { score, a: a.id, b: b.id };
      }
    }
  }
  return best;
};

const CONNECTING = new Set<ClaimField>(["coreClaim", "keyPoint", "recipe"]);
const BIG_PICTURE = new Set<ClaimField>(["bigPicture"]);

const claimText = (entry: Entry, id: string) => entry.claims.find((claim) => claim.id === id)?.text ?? "";

const findCandidates = (entries: Map<string, Entry>): Candidate[] => {
  const list = [...entries.values()];
  const scores = new Map<string, Array<{ other: string; score: number; a: string; b: string }>>();
  for (const left of list) {
    const row: Array<{ other: string; score: number; a: string; b: string }> = [];
    for (const right of list) {
      if (right.overview.id !== left.overview.id) {
        row.push({ other: right.overview.id, ...bestPair(left, right, CONNECTING) });
      }
    }
    row.sort((x, y) => y.score - x.score);
    scores.set(left.overview.id, row);
  }

  const candidates = new Map<string, Candidate>();
  const make = (aId: string, bId: string, origin: Candidate["origin"], rank: number | null): Candidate => {
    const a = entries.get(aId)!;
    const b = entries.get(bId)!;
    const best = bestPair(a, b, CONNECTING);
    const sharedTopic = a.overview.topicIds.some((topic) => b.overview.topicIds.includes(topic));
    return {
      key: pairKey(aId, bId),
      a: aId,
      b: bId,
      origin,
      rank,
      score: best.score,
      bigPictureScore: bestPair(a, b, BIG_PICTURE).score,
      aClaim: best.a,
      bClaim: best.b,
      wordOverlap: wordOverlapOf(claimText(a, best.a), claimText(b, best.b)),
      sharedTopic,
    };
  };

  for (const [id, row] of scores) {
    row.slice(0, PARTNERS_PER_OVERVIEW).forEach((match, index) => {
      const key = pairKey(id, match.other);
      const existing = candidates.get(key);
      if (existing === undefined) {
        candidates.set(key, make(id, match.other, "embedding", index + 1));
      } else if (existing.rank !== null && index + 1 < existing.rank) {
        existing.rank = index + 1;
      }
    });
  }

  for (const entry of list) {
    for (const similar of entry.overview.verdict?.similarTo ?? []) {
      if (!entries.has(similar.overviewId) || similar.overviewId === entry.overview.id) {
        continue;
      }
      const key = pairKey(entry.overview.id, similar.overviewId);
      const existing = candidates.get(key);
      if (existing === undefined) {
        candidates.set(key, make(entry.overview.id, similar.overviewId, "similarTo", null));
      } else if (existing.origin === "embedding") {
        existing.origin = "both";
      }
    }
  }
  return [...candidates.values()].sort((x, y) => y.score - x.score);
};

const CLAIM_NAMES: Record<ClaimField, string> = {
  keyPoint: "Key point",
  coreClaim: "Core claim",
  bigPicture: "Big picture",
  recipe: "Recipe",
};

const noteBlock = (label: string, entry: Entry): string => {
  const lines = [`## ${label}: ${entry.title} (${entry.overview.source.kind})`];
  for (const claim of entry.claims) {
    const name = claim.field === "keyPoint" ? `Key point ${claim.id}` : CLAIM_NAMES[claim.field];
    lines.push(`- [${claim.id}] ${name}: ${claim.text}`);
  }
  return lines.join("\n");
};

const pairMessage = (entries: Map<string, Entry>, candidate: Candidate): string =>
  `${noteBlock("Note A", entries.get(candidate.a)!)}\n\n${noteBlock("Note B", entries.get(candidate.b)!)}`;

const RELATION_GUIDE = `Relations:
- same_claim: both notes make essentially the same claim.
- builds_on: one note's idea extends, applies or gives the mechanism behind the other's.
- contradicts: the notes disagree on a specific claim.
- shared_idea: different subjects that rest on the same underlying idea, so reading one sheds light on the other.
- same_topic_only: same subject area, but no idea in common worth pointing out.
- unrelated: nothing meaningful in common.`;

const LABEL_PROMPT = `You compare two notes from one reader's library of overviews of videos, articles and podcasts. Decide how their ideas connect.

${RELATION_GUIDE}

Be strict. Sharing a subject is not a connection: that is same_topic_only. A connection is an idea in one note that changes or sharpens how the reader would read the other.

reason: one sentence for the reader, at most 30 words, saying what connects them in plain words, specific to these two notes. Never start with "Both". For same_topic_only or unrelated, say what they share or don't.
aPoints and bPoints: the ids in square brackets of the claims the connection rests on, empty for same_topic_only or unrelated.`;

const JUDGE_PROMPT = `You are checking a tool that links notes in a reader's library when their ideas connect. You see two notes. Judge them yourself.

${RELATION_GUIDE}

verdict:
- real: a thoughtful reader would agree these ideas connect, and seeing the link would be useful.
- stretch: there is a link, but it is generic, thin or forced.
- not_connected: no connection beyond, at most, a shared subject.
worthShowing: would a reader with both notes want this link pointed out to them?
why: one sentence.`;

const STRICT_LABEL_PROMPT = `You link notes in one reader's library of overviews of videos, articles and podcasts, but only when their ideas genuinely connect. You see two notes.

${RELATION_GUIDE}

verdict:
- real: a thoughtful reader would agree these ideas connect, and seeing the link would be useful.
- stretch: there is a link, but it is generic, thin or forced.
- not_connected: no connection beyond, at most, a shared subject.
Most pairs that share a subject are stretch or not_connected. Say real only when a specific idea in one note changes or sharpens how the reader would read the other.

reason: one sentence for the reader, at most 30 words, naming the specific idea the two share, using only what the notes say.
- Never say one note extends, sharpens, applies, explains or makes concrete the other, unless one note itself says so. Say what each says instead.
- Name the idea, not the subject. "Both are about AI and work" is not a reason.
- Never start with "Both".`;

const REASON_PROMPT = `A tool linked two notes in a reader's library and wrote a one-line reason. Check the reason against both notes.
trueToBoth: every part of it is supported by what the notes say.
specific: it names the actual shared idea, rather than something that would fit any two notes on the subject.
problem: what is wrong, or "" if nothing.`;

const jsonSchemaOf = (schema: z.ZodType): object => {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json["$schema"];
  return json;
};

const openAiJson = async <T>(system: string, user: string, schema: z.ZodType<T>): Promise<T & Priced> => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env["OPENAI_API_KEY"]}` },
    body: JSON.stringify({
      model: LABELLER.model,
      max_completion_tokens: 4_000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "reply", strict: true, schema: jsonSchemaOf(schema) } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`OpenAI answered ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { choices: Array<{ message: { content: string | null } }> };
  const usage = tokenUsageOf("openai", body);
  const parsed = schema.parse(JSON.parse(body.choices[0]?.message.content ?? ""));
  return { ...parsed, usage, costDollars: usage === null ? 0 : costInDollars(priceOf(LABELLER)!, usage) };
};

const anthropicJson = async <T>(
  system: string,
  user: string,
  schema: z.ZodType<T>,
  model: { provider: "anthropic"; model: string } = JUDGE,
): Promise<T & Priced> => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env["ANTHROPIC_API_KEY"] ?? "", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: model.model,
      max_tokens: 2_000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: jsonSchemaOf(schema) } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Anthropic answered ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  const usage = tokenUsageOf("anthropic", body);
  const parsed = schema.parse(JSON.parse(body.content.find((block) => block.type === "text")?.text ?? ""));
  return { ...parsed, usage, costDollars: usage === null ? 0 : costInDollars(priceOf(model)!, usage) };
};

const seededShuffle = <T>(items: readonly T[], seed: number): T[] => {
  const copy = [...items];
  let state = seed;
  const next = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

const sampleOf = (candidates: readonly Candidate[], limit: number): Candidate[] => {
  const embedding = seededShuffle(
    candidates.filter((candidate) => candidate.origin !== "similarTo"),
    SAMPLE_SEED,
  );
  const similar = seededShuffle(
    candidates.filter((candidate) => candidate.origin === "similarTo"),
    SAMPLE_SEED,
  );
  const similarShare = Math.round(limit / 3);
  return [...embedding.slice(0, limit - similarShare), ...similar.slice(0, similarShare)];
};

const spent = (results: Results): number =>
  [
    ...Object.values(results.labels),
    ...Object.values(results.judgments),
    ...Object.values(results.reasonChecks),
    ...Object.values(results.strictLabels ?? {}),
    ...Object.values(results.strictReasonChecks ?? {}),
  ].reduce((sum, item) => sum + item.costDollars, 0);

const loadResults = async (path: string): Promise<Results> =>
  JSON.parse(await readFile(path, "utf-8").catch(() => '{"labels":{},"judgments":{},"reasonChecks":{}}')) as Results;

const run = async (dataDir: string, limit: number, budget: number): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates.json"), "utf-8")) as Candidate[];
  const sample = sampleOf(candidates, limit);
  const resultsPath = join(dataDir, "results.json");
  const results = await loadResults(resultsPath);
  const save = () => writeFile(resultsPath, `${JSON.stringify(results, null, 1)}\n`);
  for (const candidate of sample) {
    if (spent(results) >= budget) {
      console.error(`stopped at the budget, $${spent(results).toFixed(4)}`);
      break;
    }
    const message = pairMessage(entries, candidate);
    try {
      if (results.labels[candidate.key] === undefined) {
        results.labels[candidate.key] = await openAiJson(LABEL_PROMPT, message, Label);
      }
      if (results.judgments[candidate.key] === undefined) {
        results.judgments[candidate.key] = await anthropicJson(JUDGE_PROMPT, message, Judgment);
      }
      const label = results.labels[candidate.key]!;
      if (CONNECTED.has(label.relation) && results.reasonChecks[candidate.key] === undefined) {
        results.reasonChecks[candidate.key] = await anthropicJson(
          REASON_PROMPT,
          `${message}\n\n## The reason\n${label.reason}`,
          ReasonCheck,
        );
      }
      results.strictLabels ??= {};
      results.strictReasonChecks ??= {};
      if (results.strictLabels[candidate.key] === undefined) {
        results.strictLabels[candidate.key] = await openAiJson(STRICT_LABEL_PROMPT, message, StrictLabel);
      }
      const strict = results.strictLabels[candidate.key]!;
      if (strict.verdict === "real" && results.strictReasonChecks[candidate.key] === undefined) {
        results.strictReasonChecks[candidate.key] = await anthropicJson(
          REASON_PROMPT,
          `${message}\n\n## The reason\n${strict.reason}`,
          ReasonCheck,
        );
      }
      console.error(
        `${candidate.origin.padEnd(9)} ${candidate.score.toFixed(3)} ${label.relation.padEnd(15)} strict ${strict.verdict.padEnd(13)} judge ${results.judgments[candidate.key]!.verdict}`,
      );
    } catch (error) {
      console.error(`FAILED ${candidate.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await save();
  }
  console.error(`spent $${spent(results).toFixed(4)} in all`);
};

const share = (part: number, whole: number) => (whole === 0 ? "–" : `${part}/${whole} (${Math.round((part / whole) * 100)}%)`);

const report = async (dataDir: string): Promise<void> => {
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates.json"), "utf-8")) as Candidate[];
  const results = await loadResults(join(dataDir, "results.json"));
  const done = candidates.filter(
    (candidate) => results.labels[candidate.key] !== undefined && results.judgments[candidate.key] !== undefined,
  );
  const lines: string[] = [];
  const section = (title: string, rows: Candidate[]) => {
    const linked = rows.filter((candidate) => CONNECTED.has(results.labels[candidate.key]!.relation));
    const real = linked.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
    const stretch = linked.filter((candidate) => results.judgments[candidate.key]!.verdict === "stretch");
    const worth = linked.filter((candidate) => results.judgments[candidate.key]!.worthShowing);
    const judgeLinks = rows.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
    const caught = judgeLinks.filter((candidate) => CONNECTED.has(results.labels[candidate.key]!.relation));
    const reasons = linked.filter((candidate) => results.reasonChecks[candidate.key] !== undefined);
    const goodReasons = reasons.filter(
      (candidate) => results.reasonChecks[candidate.key]!.trueToBoth && results.reasonChecks[candidate.key]!.specific,
    );
    lines.push(
      `| ${title} | ${rows.length} | ${linked.length} | ${share(real.length, linked.length)} | ${share(stretch.length, linked.length)} | ${share(worth.length, linked.length)} | ${share(caught.length, judgeLinks.length)} | ${share(goodReasons.length, reasons.length)} |`,
    );
  };
  lines.push(
    "| Set | Pairs | Labelled connected | Judge: real | Judge: stretch | Worth showing | Judge's real ones labelled connected | Reason true and specific |",
  );
  lines.push("|---|---|---|---|---|---|---|---|");
  const embedding = done.filter((candidate) => candidate.origin !== "similarTo");
  section("Embedding candidates", embedding);
  section(
    "… rank 1",
    embedding.filter((candidate) => candidate.rank === 1),
  );
  section(
    "… rank 2–3",
    embedding.filter((candidate) => candidate.rank !== null && candidate.rank > 1),
  );
  section(
    "… different words (overlap < 0.1)",
    embedding.filter((candidate) => candidate.wordOverlap < 0.1),
  );
  section(
    "… different topics",
    embedding.filter((candidate) => !candidate.sharedTopic),
  );
  section(
    "similarTo (OV-217), all",
    done.filter((candidate) => candidate.origin !== "embedding"),
  );
  section(
    "similarTo only, not an embedding candidate",
    done.filter((candidate) => candidate.origin === "similarTo"),
  );

  lines.push(
    "",
    'Strict arm: Luna with the judge\'s rubric, keeping only its own "real".',
    "",
    "| Set | Pairs | Strict said real | Judge: real | Judge: stretch | Judge's real ones strict kept | Reason true and specific |",
    "|---|---|---|---|---|---|---|",
  );
  const strictSection = (title: string, rows: Candidate[]) => {
    const strictRows = rows.filter((candidate) => results.strictLabels?.[candidate.key] !== undefined);
    const kept = strictRows.filter((candidate) => results.strictLabels![candidate.key]!.verdict === "real");
    const real = kept.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
    const stretch = kept.filter((candidate) => results.judgments[candidate.key]!.verdict === "stretch");
    const judgeReal = strictRows.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
    const caught = judgeReal.filter((candidate) => results.strictLabels![candidate.key]!.verdict === "real");
    const checked = kept.filter((candidate) => results.strictReasonChecks?.[candidate.key] !== undefined);
    const good = checked.filter(
      (candidate) => results.strictReasonChecks![candidate.key]!.trueToBoth && results.strictReasonChecks![candidate.key]!.specific,
    );
    lines.push(
      `| ${title} | ${strictRows.length} | ${kept.length} | ${share(real.length, kept.length)} | ${share(stretch.length, kept.length)} | ${share(caught.length, judgeReal.length)} | ${share(good.length, checked.length)} |`,
    );
  };
  strictSection("Embedding candidates", embedding);
  strictSection(
    "… different words (overlap < 0.1)",
    embedding.filter((candidate) => candidate.wordOverlap < 0.1),
  );
  strictSection(
    "… different topics",
    embedding.filter((candidate) => !candidate.sharedTopic),
  );
  strictSection(
    "similarTo (OV-217), all",
    done.filter((candidate) => candidate.origin !== "embedding"),
  );
  strictSection("All", done);

  const relationRows = RELATIONS.map((relation) => {
    const labelled = done.filter((candidate) => results.labels[candidate.key]!.relation === relation);
    const agreed = labelled.filter((candidate) => results.judgments[candidate.key]!.relation === relation);
    return `| ${relation} | ${labelled.length} | ${share(agreed.length, labelled.length)} |`;
  });
  lines.push("", "| Labeller's relation | Pairs | Judge chose the same |", "|---|---|---|", ...relationRows);

  const similarAll = done.filter((candidate) => candidate.origin !== "embedding");
  const sameOrShared = similarAll.filter((candidate) =>
    ["same_claim", "shared_idea", "builds_on"].includes(results.judgments[candidate.key]!.relation),
  );
  const sameClaim = similarAll.filter((candidate) => results.judgments[candidate.key]!.relation === "same_claim");
  lines.push(
    "",
    `similarTo, judged: same claim ${share(sameClaim.length, similarAll.length)}; same claim, shared idea or builds on ${share(sameOrShared.length, similarAll.length)}.`,
  );

  const labelCosts = done.map((candidate) => results.labels[candidate.key]!.costDollars);
  const meanLabel = labelCosts.reduce((sum, cost) => sum + cost, 0) / Math.max(1, labelCosts.length);
  lines.push(
    "",
    `Pairs done: ${done.length} of ${candidates.length} candidates. Spent $${spent(results).toFixed(4)}. Labelling (the production step) costs $${meanLabel.toFixed(6)} a pair on average.`,
  );
  console.log(lines.join("\n"));
};

const review = async (dataDir: string): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates.json"), "utf-8")) as Candidate[];
  const results = await loadResults(join(dataDir, "results.json"));
  const done = candidates.filter((candidate) => results.labels[candidate.key] !== undefined);
  for (const candidate of done) {
    const label = results.labels[candidate.key]!;
    const judgment = results.judgments[candidate.key];
    const check = results.reasonChecks[candidate.key];
    console.log(
      `\n### ${candidate.origin} ${candidate.score.toFixed(3)} rank ${candidate.rank ?? "-"} words ${candidate.wordOverlap.toFixed(2)} ${candidate.sharedTopic ? "same topic" : "different topics"}`,
    );
    console.log(`A: ${entries.get(candidate.a)!.title}\n   ${candidate.aClaim}: ${claimText(entries.get(candidate.a)!, candidate.aClaim)}`);
    console.log(`B: ${entries.get(candidate.b)!.title}\n   ${candidate.bClaim}: ${claimText(entries.get(candidate.b)!, candidate.bClaim)}`);
    console.log(`label: ${label.relation} — ${label.reason}`);
    if (judgment !== undefined) {
      console.log(`judge: ${judgment.relation} / ${judgment.verdict} / worth ${judgment.worthShowing} — ${judgment.why}`);
    }
    if (check !== undefined) {
      console.log(`reason: true ${check.trueToBoth}, specific ${check.specific} ${check.problem}`);
    }
  }
};

const candidatesCommand = async (dataDir: string): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const candidates = findCandidates(entries);
  await writeFile(join(dataDir, "candidates.json"), `${JSON.stringify(candidates, null, 1)}\n`);
  const byOrigin = (origin: Candidate["origin"]) => candidates.filter((candidate) => candidate.origin === origin).length;
  const scores = candidates.filter((candidate) => candidate.origin !== "similarTo").map((candidate) => candidate.score);
  const quantile = (q: number) => [...scores].sort((x, y) => x - y)[Math.floor(q * (scores.length - 1))]?.toFixed(3);
  console.error(
    `${entries.size} overviews → ${candidates.length} candidate pairs: ${byOrigin("embedding")} embedding only, ${byOrigin("both")} both, ${byOrigin("similarTo")} similarTo only. Embedding scores: min ${quantile(0)}, median ${quantile(0.5)}, max ${quantile(1)}. Different words (< 0.1): ${candidates.filter((candidate) => candidate.origin !== "similarTo" && candidate.wordOverlap < 0.1).length}. Different topics: ${candidates.filter((candidate) => candidate.origin !== "similarTo" && !candidate.sharedTopic).length}.`,
  );
};

const RELATIONS_V2 = ["same_claim", "builds_on", "contradicts", "different_view", "shared_idea", "same_topic_only", "unrelated"] as const;

const RELATION_GUIDE_V2 = `Relations:
- same_claim: both notes make essentially the same claim.
- builds_on: one note's idea extends, applies or gives the mechanism behind the other's.
- contradicts: the notes disagree on a specific claim of fact.
- different_view: both address the same question or decision and reach different answers, or recommend different approaches to it.
- shared_idea: different subjects that rest on the same underlying idea, so reading one sheds light on the other.
- same_topic_only: same subject area, but no idea, question or disagreement in common worth pointing out.
- unrelated: nothing meaningful in common.`;

const VERDICT_GUIDE = `verdict:
- real: a thoughtful reader would agree these ideas connect, and seeing the link would be useful. Two notes answering the same question differently is a real connection.
- stretch: there is a link, but it is generic, thin or forced.
- not_connected: no connection beyond, at most, a shared subject.`;

const LabelV2 = z.object({
  relation: z.enum(RELATIONS_V2),
  verdict: z.enum(["real", "stretch", "not_connected"]),
  reason: z.string(),
  forYou: z.string(),
});
type LabelV2 = z.infer<typeof LabelV2>;

const JudgmentV2 = z.object({
  relation: z.enum(RELATIONS_V2),
  verdict: z.enum(["real", "stretch", "not_connected"]),
  worthShowing: z.boolean(),
  why: z.string(),
});
type JudgmentV2 = z.infer<typeof JudgmentV2>;

const PersonalCheck = z.object({ grounded: z.boolean(), tentative: z.boolean(), followsFromLink: z.boolean(), problem: z.string() });
type PersonalCheck = z.infer<typeof PersonalCheck>;

interface Candidate2 extends Candidate {
  crossTopic: boolean;
  surprising: boolean;
}

interface Results2 {
  labels: Record<string, LabelV2 & Priced>;
  unknownReader: Record<string, LabelV2 & Priced>;
  judgments: Record<string, JudgmentV2 & Priced>;
  reasonChecks: Record<string, ReasonCheck & Priced>;
  personalChecks: Record<string, PersonalCheck & Priced>;
}

const LABEL_PROMPT_V2 = `You link notes in one reader's library of overviews of videos, articles and podcasts, but only when their ideas genuinely connect. You see what is known about the reader, then two notes.

${RELATION_GUIDE_V2}

${VERDICT_GUIDE}
Most pairs that share a subject are stretch or not_connected. Say real only when a specific idea in one note changes or sharpens how the reader would read the other, or when the two answer the same question differently.

reason: one sentence, at most 30 words, naming the specific idea the two share, or for different_view and contradicts, what each says. Use only what the notes say.
- Never say one note extends, sharpens, applies, explains or makes concrete the other, unless one note itself says so. Say what each says instead.
- Name the idea, not the subject. "Both are about AI and work" is not a reason.
- Never start with "Both".

forYou: one short clause on why this link might matter to this reader, such as "might help with your app's onboarding". Keep it tentative ("might", "could"). Draw it only from what is said about the reader. Leave it "" when the verdict isn't real, when nothing known about the reader bears on it, or when nothing is known. Never guess an interest the reader hasn't stated.`;

const JUDGE_PROMPT_V2 = `You are checking a tool that links notes in a reader's library when their ideas connect. You see two notes. Judge them yourself.

${RELATION_GUIDE_V2}

${VERDICT_GUIDE}
worthShowing: would a reader with both notes want this link pointed out to them?
why: one sentence.`;

const PERSONAL_PROMPT = `A tool linked two notes in a reader's library and added a short clause on why the link might matter to this reader. You see what the tool knew about the reader, the two notes and the clause.
grounded: the clause rests on something actually said about the reader, not a guessed interest.
tentative: it suggests rather than asserts ("might", "could").
followsFromLink: it follows from what connects the two notes.
problem: what is wrong, or "" if nothing.`;

const readerBlockOf = async (dataDir: string): Promise<string> => {
  const raw = JSON.parse(await readFile(join(dataDir, "profile", "library.json"), "utf-8")) as {
    settings?: { schemaVersion: number; body: unknown };
    projects: Array<{ schemaVersion: number; body: unknown }>;
  };
  if (raw.settings === undefined) {
    throw new Error("export again: this export has no settings");
  }
  const settings = readStoredRecord(
    stampSchemaVersion(raw.settings.body as Record<string, unknown>, raw.settings.schemaVersion),
    Settings,
    SETTINGS_MIGRATIONS,
  );
  if (settings.status !== "read") {
    throw new Error(`settings did not read: ${settings.status}`);
  }
  const context = composeReaderContext(settings.record.aboutYou, settings.record.learned);
  const projects = raw.projects.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion), Project, PROJECT_MIGRATIONS);
    return read.status === "read" && read.record.archivedAt === null ? [read.record] : [];
  });
  const projectLines = projects.map((project) => `- ${project.name}${project.purpose === null ? "" : `: ${project.purpose}`}`);
  return [
    `# About the reader\n${context ?? "Nothing is known about this reader."}`,
    projectLines.length === 0 ? "" : `# Projects they are working on\n${projectLines.join("\n")}`,
  ]
    .filter((part) => part !== "")
    .join("\n\n");
};

const UNKNOWN_READER = "# About the reader\nNothing is known about this reader.";

const CROSS_TOPIC_PARTNERS = 2;

const candidates2Command = async (dataDir: string): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const first = JSON.parse(await readFile(join(dataDir, "candidates.json"), "utf-8")) as Candidate[];
  const known = new Set(first.map((candidate) => candidate.key));
  const list = [...entries.values()];
  const crossTopic: Candidate2[] = [];
  const seen = new Set<string>();
  for (const left of list) {
    if (left.overview.topicIds.length === 0) {
      continue;
    }
    const row = list
      .filter(
        (right) =>
          right.overview.id !== left.overview.id &&
          right.overview.topicIds.length > 0 &&
          !right.overview.topicIds.some((topic) => left.overview.topicIds.includes(topic)),
      )
      .map((right) => ({ right, ...bestPair(left, right, CONNECTING) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, CROSS_TOPIC_PARTNERS);
    row.forEach((match, index) => {
      const key = pairKey(left.overview.id, match.right.overview.id);
      if (seen.has(key) || known.has(key)) {
        return;
      }
      seen.add(key);
      const wordOverlap = wordOverlapOf(claimText(left, match.a), claimText(match.right, match.b));
      crossTopic.push({
        key,
        a: left.overview.id,
        b: match.right.overview.id,
        origin: "embedding",
        rank: index + 1,
        score: match.score,
        bigPictureScore: bestPair(left, match.right, BIG_PICTURE).score,
        aClaim: match.a,
        bClaim: match.b,
        wordOverlap,
        sharedTopic: false,
        crossTopic: true,
        surprising: wordOverlap < 0.1,
      });
    });
  }
  const sample = sampleOf(first, 120);
  const fromFirst: Candidate2[] = [
    ...sample.filter((candidate) => candidate.origin !== "similarTo").slice(0, 50),
    ...sample.filter((candidate) => candidate.origin === "similarTo").slice(0, 20),
  ].map((candidate) => ({ ...candidate, crossTopic: false, surprising: !candidate.sharedTopic && candidate.wordOverlap < 0.1 }));
  const chosen = [...fromFirst, ...seededShuffle(crossTopic, SAMPLE_SEED).slice(0, 40)];
  await writeFile(join(dataDir, "candidates2.json"), `${JSON.stringify(chosen, null, 1)}\n`);
  console.error(
    `${crossTopic.length} new cross-topic candidates; round 2 runs ${chosen.length}: ${fromFirst.length} from round 1, ${chosen.length - fromFirst.length} cross-topic`,
  );
};

const loadResults2 = async (path: string): Promise<Results2> =>
  JSON.parse(
    await readFile(path, "utf-8").catch(() => '{"labels":{},"unknownReader":{},"judgments":{},"reasonChecks":{},"personalChecks":{}}'),
  ) as Results2;

const spent2 = (results: Results2): number =>
  [results.labels, results.unknownReader, results.judgments, results.reasonChecks, results.personalChecks]
    .flatMap((group) => Object.values(group))
    .reduce((sum, item) => sum + item.costDollars, 0);

const UNKNOWN_READER_PAIRS = 20;

const run2 = async (dataDir: string, budget: number): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const reader = await readerBlockOf(dataDir);
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates2.json"), "utf-8")) as Candidate2[];
  const resultsPath = join(dataDir, "results2.json");
  const results = await loadResults2(resultsPath);
  const save = () => writeFile(resultsPath, `${JSON.stringify(results, null, 1)}\n`);
  for (const [index, candidate] of candidates.entries()) {
    if (spent2(results) >= budget) {
      console.error(`stopped at the budget, $${spent2(results).toFixed(4)}`);
      break;
    }
    const notes = pairMessage(entries, candidate);
    try {
      results.labels[candidate.key] ??= await openAiJson(LABEL_PROMPT_V2, `${reader}\n\n${notes}`, LabelV2);
      if (index < UNKNOWN_READER_PAIRS) {
        results.unknownReader[candidate.key] ??= await openAiJson(LABEL_PROMPT_V2, `${UNKNOWN_READER}\n\n${notes}`, LabelV2);
      }
      results.judgments[candidate.key] ??= await anthropicJson(JUDGE_PROMPT_V2, notes, JudgmentV2);
      const label = results.labels[candidate.key]!;
      if (label.verdict === "real") {
        results.reasonChecks[candidate.key] ??= await anthropicJson(
          REASON_PROMPT,
          `${notes}\n\n## The reason\n${label.reason}`,
          ReasonCheck,
        );
      }
      if (label.verdict === "real" && label.forYou.trim() !== "") {
        results.personalChecks[candidate.key] ??= await anthropicJson(
          PERSONAL_PROMPT,
          `${reader}\n\n${notes}\n\n## The reason\n${label.reason}\n\n## The clause for the reader\n${label.forYou}`,
          PersonalCheck,
        );
      }
      console.error(
        `${candidate.crossTopic ? "cross    " : candidate.origin.padEnd(9)} ${label.relation.padEnd(15)} ${label.verdict.padEnd(13)} judge ${results.judgments[candidate.key]!.relation.padEnd(15)} ${results.judgments[candidate.key]!.verdict}`,
      );
    } catch (error) {
      console.error(`FAILED ${candidate.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await save();
  }
  console.error(`spent $${spent2(results).toFixed(4)} in all`);
};

const report2 = async (dataDir: string): Promise<void> => {
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates2.json"), "utf-8")) as Candidate2[];
  const results = await loadResults2(join(dataDir, "results2.json"));
  const done = candidates.filter(
    (candidate) => results.labels[candidate.key] !== undefined && results.judgments[candidate.key] !== undefined,
  );
  const lines = [
    "| Set | Pairs | Luna said real | Judge: real | Judge: stretch | Judge's real ones Luna kept | Reason true and specific | For-you clause given | For-you grounded, tentative, follows |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  const section = (title: string, rows: Candidate2[]) => {
    const kept = rows.filter((candidate) => results.labels[candidate.key]!.verdict === "real");
    const real = kept.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
    const stretch = kept.filter((candidate) => results.judgments[candidate.key]!.verdict === "stretch");
    const judgeReal = rows.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
    const caught = judgeReal.filter((candidate) => results.labels[candidate.key]!.verdict === "real");
    const checked = kept.filter((candidate) => results.reasonChecks[candidate.key] !== undefined);
    const good = checked.filter(
      (candidate) => results.reasonChecks[candidate.key]!.trueToBoth && results.reasonChecks[candidate.key]!.specific,
    );
    const withClause = kept.filter((candidate) => results.labels[candidate.key]!.forYou.trim() !== "");
    const personal = withClause.filter((candidate) => results.personalChecks[candidate.key] !== undefined);
    const goodPersonal = personal.filter((candidate) => {
      const check = results.personalChecks[candidate.key]!;
      return check.grounded && check.tentative && check.followsFromLink;
    });
    lines.push(
      `| ${title} | ${rows.length} | ${kept.length} | ${share(real.length, kept.length)} | ${share(stretch.length, kept.length)} | ${share(caught.length, judgeReal.length)} | ${share(good.length, checked.length)} | ${share(withClause.length, kept.length)} | ${share(goodPersonal.length, personal.length)} |`,
    );
  };
  section("All", done);
  section(
    "Round 1 embedding pairs",
    done.filter((candidate) => !candidate.crossTopic && candidate.origin !== "similarTo"),
  );
  section(
    "similarTo (OV-217)",
    done.filter((candidate) => candidate.origin !== "embedding"),
  );
  section(
    "Cross-topic candidates (new)",
    done.filter((candidate) => candidate.crossTopic),
  );
  section(
    "Surprising: different topics and words",
    done.filter((candidate) => candidate.surprising),
  );

  lines.push("", "| Relation | Luna chose | Judge chose | Both chose it |", "|---|---|---|---|");
  for (const relation of RELATIONS_V2) {
    const luna = done.filter((candidate) => results.labels[candidate.key]!.relation === relation);
    const judge = done.filter((candidate) => results.judgments[candidate.key]!.relation === relation);
    const both = luna.filter((candidate) => results.judgments[candidate.key]!.relation === relation);
    lines.push(`| ${relation} | ${luna.length} | ${judge.length} | ${both.length} |`);
  }
  const differentView = done.filter((candidate) => results.judgments[candidate.key]!.relation === "different_view");
  const differentViewReal = differentView.filter((candidate) => results.judgments[candidate.key]!.verdict === "real");
  lines.push("", `Judge's different_view pairs it called real: ${share(differentViewReal.length, differentView.length)}.`);

  const unknown = Object.keys(results.unknownReader);
  const silent = unknown.filter((key) => results.unknownReader[key]!.forYou.trim() === "");
  lines.push(`Nothing known about the reader → no for-you clause: ${share(silent.length, unknown.length)}.`);

  const labelCosts = done.map((candidate) => results.labels[candidate.key]!.costDollars);
  const meanLabel = labelCosts.reduce((sum, cost) => sum + cost, 0) / Math.max(1, labelCosts.length);
  lines.push(
    `Pairs done: ${done.length} of ${candidates.length}. Spent $${spent2(results).toFixed(4)}. Labelling with the profile costs $${meanLabel.toFixed(6)} a pair on average.`,
  );
  console.log(lines.join("\n"));
};

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const REVIEW_PAIRS = 20;

const reviewPage = async (dataDir: string): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates2.json"), "utf-8")) as Candidate2[];
  const results = await loadResults2(join(dataDir, "results2.json"));
  const done = seededShuffle(
    candidates.filter((candidate) => results.labels[candidate.key] !== undefined && results.judgments[candidate.key] !== undefined),
    SAMPLE_SEED,
  );
  const lunaReal = (candidate: Candidate2) => results.labels[candidate.key]!.verdict === "real";
  const judgeReal = (candidate: Candidate2) => results.judgments[candidate.key]!.verdict === "real";
  const picked = new Map<string, Candidate2>();
  const take = (rows: Candidate2[], count: number) =>
    rows
      .filter((row) => !picked.has(row.key))
      .slice(0, count)
      .forEach((row) => picked.set(row.key, row));
  take(
    done.filter((candidate) => lunaReal(candidate) && candidate.crossTopic),
    4,
  );
  take(
    done.filter((candidate) => lunaReal(candidate) && ["different_view", "contradicts"].includes(results.labels[candidate.key]!.relation)),
    3,
  );
  take(
    done.filter((candidate) => lunaReal(candidate) && candidate.origin !== "embedding"),
    3,
  );
  take(
    done.filter((candidate) => lunaReal(candidate) !== judgeReal(candidate)),
    5,
  );
  take(
    done.filter((candidate) => lunaReal(candidate)),
    REVIEW_PAIRS,
  );
  take(done, REVIEW_PAIRS);
  const chosen = seededShuffle([...picked.values()].slice(0, REVIEW_PAIRS), SAMPLE_SEED + 1);

  const noteHtml = (entry: Entry, claimId: string) =>
    `<div class="note"><h3>${escapeHtml(entry.title)}</h3><p class="kind">${escapeHtml(entry.overview.source.kind)}</p><p><b>Core claim:</b> ${escapeHtml(entry.overview.coreClaim)}</p>${
      claimId === "core" ? "" : `<p><b>Closest point:</b> ${escapeHtml(claimText(entry, claimId))}</p>`
    }</div>`;
  const radios = (name: string, options: Array<[string, string]>) =>
    options.map(([value, text]) => `<label><input type="radio" name="${name}" value="${value}"> ${text}</label>`).join("");
  const cards = chosen
    .map((candidate, index) => {
      const label = results.labels[candidate.key]!;
      const shown = label.verdict === "real";
      return `<section class="pair" data-key="${candidate.key}">
<h2>Pair ${index + 1}</h2>
<div class="notes">${noteHtml(entries.get(candidate.a)!, candidate.aClaim)}${noteHtml(entries.get(candidate.b)!, candidate.bClaim)}</div>
<fieldset><legend>Are these two connected in a way you'd want pointed out?</legend>${radios(`c${index}`, [
        ["real", "Yes, a real connection"],
        ["stretch", "A stretch"],
        ["no", "No"],
      ])}</fieldset>
<div class="reveal" hidden>
<p class="tool">The tool said: <b>${shown ? "connected" : "not worth linking"}</b> (${escapeHtml(label.relation.replace(/_/g, " "))})</p>
<p class="reason">“${escapeHtml(label.reason)}”</p>
${label.forYou.trim() === "" ? "" : `<p class="foryou">For you: “${escapeHtml(label.forYou)}”</p>`}
<fieldset><legend>Is the reason right?</legend>${radios(`r${index}`, [
        ["yes", "Right and specific"],
        ["vague", "True but vague"],
        ["wrong", "Wrong about a note"],
      ])}</fieldset>
${
  label.forYou.trim() === ""
    ? ""
    : `<fieldset><legend>Is the “for you” line fair?</legend>${radios(`p${index}`, [
        ["yes", "Yes"],
        ["off", "Off the mark"],
        ["invented", "Guesses something about me"],
      ])}</fieldset>`
}
</div>
<textarea placeholder="Anything else (optional)" rows="2"></textarea>
</section>`;
    })
    .join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connections review</title>
<style>
:root{--bg:#faf9f6;--fg:#1d1c1a;--muted:#6b6862;--card:#fff;--line:#e3e0da;--accent:#2f5d50}
@media (prefers-color-scheme: dark){:root{--bg:#171614;--fg:#ece9e3;--muted:#a19d95;--card:#211f1c;--line:#3a3732;--accent:#8fc1b1}}
body{background:var(--bg);color:var(--fg);font:1rem/1.5 system-ui,sans-serif;margin:0;padding:1rem}
main{max-width:56rem;margin:0 auto}
.pair{background:var(--card);border:1px solid var(--line);border-radius:.75rem;padding:1rem;margin:1rem 0}
.notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1rem}
.note h3{margin:.25rem 0;font-size:1.05rem}.kind{color:var(--muted);margin:0;font-size:.875rem}
fieldset{border:0;padding:0;margin:.75rem 0}legend{font-weight:600;margin-bottom:.25rem}
label{display:inline-flex;gap:.35rem;margin:.25rem 1rem .25rem 0;align-items:center}
.reason{font-style:italic}.foryou{color:var(--accent)}
textarea{width:100%;box-sizing:border-box;font:inherit;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:.5rem;padding:.5rem}
button{font:inherit;padding:.6rem 1rem;border-radius:.5rem;border:0;background:var(--accent);color:var(--bg);cursor:pointer}
#out{width:100%;min-height:6rem}
</style></head><body><main>
<h1>Connections review</h1>
<p>For each pair, decide first whether the two are connected. The tool's answer and reason appear once you've chosen. When you're done, press the button at the bottom and paste the text back to Claude.</p>
${cards}
<p><button id="copy" type="button">Copy my answers</button></p>
<textarea id="out" readonly aria-label="Your answers"></textarea>
</main>
<script>
document.querySelectorAll(".pair").forEach((pair) => {
  pair.querySelectorAll('input[name^="c"]').forEach((input) => input.addEventListener("change", () => { pair.querySelector(".reveal").hidden = false; }));
});
document.getElementById("copy").addEventListener("click", async () => {
  const answers = [...document.querySelectorAll(".pair")].map((pair, index) => {
    const pick = (prefix) => pair.querySelector('input[name="' + prefix + index + '"]:checked')?.value ?? null;
    return { key: pair.dataset.key, connected: pick("c"), reason: pick("r"), forYou: pick("p"), note: pair.querySelector("textarea").value };
  });
  const text = JSON.stringify(answers);
  document.getElementById("out").value = text;
  try { await navigator.clipboard.writeText(text); document.getElementById("copy").textContent = "Copied"; } catch { document.getElementById("copy").textContent = "Copy the text below"; }
});
</script></body></html>
`;
  await writeFile(join(dataDir, "review.html"), html);
  console.error(`${chosen.length} pairs → ${join(dataDir, "review.html")}`);
};

const WRITERS = {
  sonnet: { provider: "anthropic", model: "claude-sonnet-5-5" },
  opus: { provider: "anthropic", model: "claude-opus-5-5" },
} as const;
type WriterName = keyof typeof WRITERS;

const Insight = z.object({
  obviousLink: z.string(),
  verdict: z.enum(["insight", "obvious", "not_connected"]),
  insight: z.string(),
  forYou: z.string(),
});
type Insight = z.infer<typeof Insight>;

interface Results3 {
  insights: Record<WriterName, Record<string, Insight & Priced>>;
}

const INSIGHT_PROMPT = `You find connections between two notes in one reader's library of overviews of videos, articles and podcasts, but only connections worth telling them about: ones that make them glad they kept both. Most pairs have none, and saying so is usually the right answer. You see what is known about the reader, then two notes.

obviousLink: first, in a few words, the connection anyone would see from the two titles and core claims alone, such as "both say AI speeds up software delivery". "" if there is none.

verdict:
- insight: putting the two notes together gives the reader something neither says alone, and a thoughtful reader would be glad to have it pointed out. For example: a tension between them; a condition under which one note's advice fails, given the other; one note explaining why the other's claim holds; the same question answered differently, and what decides between the answers; or an unexpected parallel across different subjects that teaches something.
- obvious: they connect, but only in the obvious way, or the combined point is well known.
- not_connected: nothing beyond, at most, a shared subject.
The obvious link alone is never an insight. Neither is a theme two notes share, however true.

insight: for verdict insight only, at most 40 words: the combined point itself, as the reader's takeaway. Don't summarise each note in turn; say what they mean together. Use only what the notes support. Never start with "Both". "" for any other verdict.

forYou: for verdict insight only, and only when the insight bears concretely on something specific said about the reader or one of their named projects: say how, tentatively ("might", "could"), at most 20 words. A generic line such as "could inform your work" is worse than nothing, so leave "". "" for any other verdict.`;

const loadResults3 = async (path: string): Promise<Results3> =>
  JSON.parse(await readFile(path, "utf-8").catch(() => '{"insights":{"sonnet":{},"opus":{}}}')) as Results3;

const spent3 = (results: Results3): number =>
  Object.values(results.insights)
    .flatMap((group) => Object.values(group))
    .reduce((sum, item) => sum + item.costDollars, 0);

const candidates3Of = async (dataDir: string): Promise<Candidate2[]> => {
  const candidates = JSON.parse(await readFile(join(dataDir, "candidates2.json"), "utf-8")) as Candidate2[];
  const results = await loadResults2(join(dataDir, "results2.json"));
  return candidates.filter((candidate) => candidate.crossTopic || results.labels[candidate.key]?.verdict === "real");
};

const run3 = async (dataDir: string, budget: number): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const reader = await readerBlockOf(dataDir);
  const candidates = await candidates3Of(dataDir);
  const resultsPath = join(dataDir, "results3.json");
  const results = await loadResults3(resultsPath);
  const save = () => writeFile(resultsPath, `${JSON.stringify(results, null, 1)}\n`);
  for (const candidate of candidates) {
    if (spent3(results) >= budget) {
      console.error(`stopped at the budget, $${spent3(results).toFixed(4)}`);
      break;
    }
    const message = `${reader}\n\n${pairMessage(entries, candidate)}`;
    try {
      const [sonnet, opus] = await Promise.all(
        (["sonnet", "opus"] as const).map(
          async (name) => (results.insights[name][candidate.key] ??= await anthropicJson(INSIGHT_PROMPT, message, Insight, WRITERS[name])),
        ),
      );
      console.error(
        `${candidate.crossTopic ? "cross    " : candidate.origin.padEnd(9)} sonnet ${sonnet!.verdict.padEnd(13)} opus ${opus!.verdict}`,
      );
    } catch (error) {
      console.error(`FAILED ${candidate.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await save();
  }
  console.error(`spent $${spent3(results).toFixed(4)} in all`);
};

const report3 = async (dataDir: string): Promise<void> => {
  const candidates = await candidates3Of(dataDir);
  const results = await loadResults3(join(dataDir, "results3.json"));
  const results2 = await loadResults2(join(dataDir, "results2.json"));
  const owner = JSON.parse(await readFile(join(dataDir, "owner-answers.json"), "utf-8").catch(() => "[]")) as Array<{
    key: string;
    connected: string;
  }>;
  const done = candidates.filter(
    (candidate) => results.insights.sonnet[candidate.key] !== undefined && results.insights.opus[candidate.key] !== undefined,
  );
  const lines = ["| Set | Pairs | Sonnet: insight | Opus: insight | Both | For-you given (Sonnet / Opus) |", "|---|---|---|---|---|---|"];
  const section = (title: string, rows: Candidate2[]) => {
    const isInsight = (name: WriterName) => (candidate: Candidate2) => results.insights[name][candidate.key]!.verdict === "insight";
    const sonnet = rows.filter(isInsight("sonnet"));
    const opus = rows.filter(isInsight("opus"));
    const both = sonnet.filter(isInsight("opus"));
    const forYou = (name: WriterName, kept: Candidate2[]) =>
      kept.filter((candidate) => results.insights[name][candidate.key]!.forYou.trim() !== "").length;
    lines.push(
      `| ${title} | ${rows.length} | ${share(sonnet.length, rows.length)} | ${share(opus.length, rows.length)} | ${share(both.length, rows.length)} | ${share(forYou("sonnet", sonnet), sonnet.length)} / ${share(forYou("opus", opus), opus.length)} |`,
    );
  };
  section("All", done);
  section(
    "Luna real, same topic or similarTo",
    done.filter((candidate) => !candidate.crossTopic),
  );
  section(
    "similarTo",
    done.filter((candidate) => candidate.origin !== "embedding"),
  );
  section(
    "Cross-topic",
    done.filter((candidate) => candidate.crossTopic),
  );
  section(
    "Judge said real (round 2)",
    done.filter((candidate) => results2.judgments[candidate.key]?.verdict === "real"),
  );
  for (const verdict of ["real", "stretch", "no"]) {
    const keys = new Set(owner.filter((answer) => answer.connected === verdict).map((answer) => answer.key));
    section(
      `Owner said ${verdict}`,
      done.filter((candidate) => keys.has(candidate.key)),
    );
  }
  const costs = (name: WriterName) => done.map((candidate) => results.insights[name][candidate.key]!.costDollars);
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  lines.push(
    "",
    `Pairs done: ${done.length} of ${candidates.length}. Spent $${spent3(results).toFixed(4)}. A pair costs $${mean(costs("sonnet")).toFixed(5)} with Sonnet, $${mean(costs("opus")).toFixed(5)} with Opus.`,
  );
  console.log(lines.join("\n"));
};

const REVIEW3_PAIRS = 15;

const reviewPage3 = async (dataDir: string): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const results = await loadResults3(join(dataDir, "results3.json"));
  const answers = JSON.parse(await readFile(join(dataDir, "owner-answers.json"), "utf-8").catch(() => "[]")) as Array<{
    key: string;
    connected: string;
  }>;
  const owner = new Set(answers.map((answer) => answer.key));
  const ownerRejected = new Set(answers.filter((answer) => answer.connected !== "real").map((answer) => answer.key));
  const done = seededShuffle(
    (await candidates3Of(dataDir)).filter(
      (candidate) => results.insights.sonnet[candidate.key] !== undefined && results.insights.opus[candidate.key] !== undefined,
    ),
    SAMPLE_SEED + 3,
  );
  const said = (name: WriterName, candidate: Candidate2) => results.insights[name][candidate.key]!.verdict === "insight";
  const picked = new Map<string, Candidate2>();
  const take = (rows: Candidate2[], count: number) =>
    rows
      .filter((row) => !picked.has(row.key))
      .slice(0, count)
      .forEach((row) => picked.set(row.key, row));
  const fresh = done.filter((candidate) => !owner.has(candidate.key));
  take(
    fresh.filter((candidate) => said("sonnet", candidate) && said("opus", candidate)),
    5,
  );
  take(
    fresh.filter((candidate) => said("sonnet", candidate) !== said("opus", candidate)),
    5,
  );
  take(
    fresh.filter((candidate) => candidate.crossTopic && (said("sonnet", candidate) || said("opus", candidate))),
    3,
  );
  take(
    done.filter((candidate) => ownerRejected.has(candidate.key)),
    3,
  );
  take(
    done.filter((candidate) => said("sonnet", candidate) || said("opus", candidate)),
    REVIEW3_PAIRS,
  );
  take(done, REVIEW3_PAIRS);
  const chosen = seededShuffle([...picked.values()].slice(0, REVIEW3_PAIRS), SAMPLE_SEED + 4);

  const noteHtml = (entry: Entry, claimId: string) =>
    `<div class="note"><h3>${escapeHtml(entry.title)}</h3><p class="kind">${escapeHtml(entry.overview.source.kind)}</p><p><b>Core claim:</b> ${escapeHtml(entry.overview.coreClaim)}</p>${
      claimId === "core" ? "" : `<p><b>Closest point:</b> ${escapeHtml(claimText(entry, claimId))}</p>`
    }</div>`;
  const radios = (name: string, options: Array<[string, string]>) =>
    options.map(([value, text]) => `<label><input type="radio" name="${name}" value="${value}"> ${text}</label>`).join("");
  const writerHtml = (index: number, slot: "x" | "y", output: Insight) => {
    const kept = output.verdict === "insight";
    return `<div class="writer" data-slot="${slot}"><h4>Writer ${slot === "x" ? "1" : "2"}</h4>${
      kept
        ? `<p class="insight">“${escapeHtml(output.insight)}”</p>${output.forYou.trim() === "" ? "" : `<p class="foryou">For you: “${escapeHtml(output.forYou)}”</p>`}`
        : `<p class="none">Nothing worth pointing out (${output.verdict === "obvious" ? "only the obvious link" : "not connected"}).</p>`
    }
<fieldset><legend>${kept ? "This insight is…" : "Saying nothing is…"}</legend>${radios(
      `${slot}${index}`,
      kept
        ? [
            ["glad", "Glad to know"],
            ["obvious", "Obvious or pointless"],
            ["wrong", "Wrong about a note"],
          ]
        : [
            ["agree", "Right"],
            ["missed", "Missed something good"],
          ],
    )}</fieldset>${
      kept && output.forYou.trim() !== ""
        ? `<fieldset><legend>The “for you” line is…</legend>${radios(`${slot}f${index}`, [
            ["useful", "Useful"],
            ["flat", "Flat or generic"],
            ["invented", "Guesses about me"],
          ])}</fieldset>`
        : ""
    }</div>`;
  };
  const cards = chosen
    .map((candidate, index) => {
      const slots = seededShuffle(["sonnet", "opus"] as const, SAMPLE_SEED + 10 + index);
      return `<section class="pair" data-key="${candidate.key}" data-x="${slots[0]}" data-y="${slots[1]}">
<h2>Pair ${index + 1}</h2>
<div class="notes">${noteHtml(entries.get(candidate.a)!, candidate.aClaim)}${noteHtml(entries.get(candidate.b)!, candidate.bClaim)}</div>
<div class="writers">${writerHtml(index, "x", results.insights[slots[0]!][candidate.key]!)}${writerHtml(index, "y", results.insights[slots[1]!][candidate.key]!)}</div>
<textarea placeholder="Anything else (optional)" rows="2"></textarea>
</section>`;
    })
    .join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connection insights</title>
<style>
:root{--bg:#faf9f6;--fg:#1d1c1a;--muted:#6b6862;--card:#fff;--line:#e3e0da;--accent:#2f5d50}
@media (prefers-color-scheme: dark){:root{--bg:#171614;--fg:#ece9e3;--muted:#a19d95;--card:#211f1c;--line:#3a3732;--accent:#8fc1b1}}
body{background:var(--bg);color:var(--fg);font:1rem/1.5 system-ui,sans-serif;margin:0;padding:1rem}
main{max-width:56rem;margin:0 auto}
.pair{background:var(--card);border:1px solid var(--line);border-radius:.75rem;padding:1rem;margin:1rem 0}
.notes,.writers{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:1rem}
.writers{margin-top:1rem;border-top:1px solid var(--line);padding-top:.5rem}
.note h3{margin:.25rem 0;font-size:1.05rem}.kind{color:var(--muted);margin:0;font-size:.875rem}
h4{margin:.5rem 0 .25rem}.insight{font-size:1.05rem}.none{color:var(--muted);font-style:italic}.foryou{color:var(--accent)}
fieldset{border:0;padding:0;margin:.5rem 0}legend{font-weight:600;margin-bottom:.25rem}
label{display:inline-flex;gap:.35rem;margin:.25rem 1rem .25rem 0;align-items:center}
textarea{width:100%;box-sizing:border-box;font:inherit;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:.5rem;padding:.5rem;margin-top:.5rem}
button{font:inherit;padding:.6rem 1rem;border-radius:.5rem;border:0;background:var(--accent);color:var(--bg);cursor:pointer}
#out{min-height:6rem}
</style></head><body><main>
<h1>Connection insights</h1>
<p>Each pair has two writers. Each one either says what the two overviews mean together, or says there's nothing worth pointing out. The bar is: would you be glad this was pointed out? The writers swap sides at random. When you're done, press the button at the bottom and paste the text back to Claude.</p>
${cards}
<p><button id="copy" type="button">Copy my answers</button></p>
<textarea id="out" readonly aria-label="Your answers"></textarea>
</main>
<script>
document.getElementById("copy").addEventListener("click", async () => {
  const answers = [...document.querySelectorAll(".pair")].map((pair, index) => {
    const pick = (name) => pair.querySelector('input[name="' + name + '"]:checked')?.value ?? null;
    return { key: pair.dataset.key, [pair.dataset.x]: { verdict: pick("x" + index), forYou: pick("xf" + index) }, [pair.dataset.y]: { verdict: pick("y" + index), forYou: pick("yf" + index) }, note: pair.querySelector("textarea").value };
  });
  const text = JSON.stringify(answers);
  document.getElementById("out").value = text;
  try { await navigator.clipboard.writeText(text); document.getElementById("copy").textContent = "Copied"; } catch { document.getElementById("copy").textContent = "Copy the text below"; }
});
</script></body></html>
`;
  await writeFile(join(dataDir, "review3.html"), html);
  console.error(`${chosen.length} pairs → ${join(dataDir, "review3.html")}`);
};

const Gate = z.object({
  alreadyThought: z.string(),
  verdict: z.enum(["worth_showing", "obvious"]),
  why: z.string(),
});
type Gate = z.infer<typeof Gate>;

const GATE_PROMPT = `A tool reads two notes in a reader's library and writes a short insight about what they mean together. Most of what it writes is obvious, so you decide what is worth showing. You see the two notes, then the insight.

alreadyThought: first, in a sentence, what a reader who had read both notes would already think about how they connect, without being told.

verdict:
- worth_showing: the insight goes well beyond that, and a thoughtful reader would be glad it was pointed out. It resolves a real tension between the notes, carries a rule from one subject to another where it teaches something, or gives a concrete thing to do that neither note gives alone. Every term it uses is clear without looking it up.
- obvious: it restates what the reader would already think, rests on a theme the notes share, is well-known advice, or is a plain "one only works if the other is done well".
When in doubt, obvious.

why: one sentence.`;

type GaterName = "sonnet" | "haiku" | "luna";
const GATERS: Record<GaterName, (system: string, user: string) => Promise<Gate & Priced>> = {
  sonnet: (system, user) => anthropicJson(system, user, Gate, WRITERS.sonnet),
  haiku: (system, user) => anthropicJson(system, user, Gate, { provider: "anthropic", model: "claude-haiku-5-5" }),
  luna: (system, user) => openAiJson(system, user, Gate),
};

interface OwnerMark3 {
  key: string;
  sonnet: { verdict: string | null };
  opus: { verdict: string | null };
}

const gateCheck = async (dataDir: string, budget: number): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const candidates = new Map((await candidates3Of(dataDir)).map((candidate) => [candidate.key, candidate]));
  const insights = await loadResults3(join(dataDir, "results3.json"));
  const marks = JSON.parse(await readFile(join(dataDir, "owner-answers3.json"), "utf-8")) as OwnerMark3[];
  const resultsPath = join(dataDir, "gate.json");
  const results = JSON.parse(await readFile(resultsPath, "utf-8").catch(() => "{}")) as Record<string, Gate & Priced>;
  const spentGate = () => Object.values(results).reduce((sum, item) => sum + item.costDollars, 0);
  const rows = marks.flatMap((mark) =>
    (["sonnet", "opus"] as const).flatMap((writer) =>
      mark[writer].verdict === "glad" || mark[writer].verdict === "obvious" ? [{ key: mark.key, writer, owner: mark[writer].verdict }] : [],
    ),
  );
  const tally: Record<GaterName, { agree: number; total: number; gladKept: number; glad: number; obviousKept: number; obvious: number }> = {
    sonnet: { agree: 0, total: 0, gladKept: 0, glad: 0, obviousKept: 0, obvious: 0 },
    haiku: { agree: 0, total: 0, gladKept: 0, glad: 0, obviousKept: 0, obvious: 0 },
    luna: { agree: 0, total: 0, gladKept: 0, glad: 0, obviousKept: 0, obvious: 0 },
  };
  for (const row of rows) {
    const message = `${pairMessage(entries, candidates.get(row.key)!)}\n\n## The insight\n${insights.insights[row.writer][row.key]!.insight}`;
    for (const gater of Object.keys(GATERS) as GaterName[]) {
      const id = `${gater}:${row.writer}:${row.key}`;
      if (results[id] === undefined && spentGate() < budget) {
        const gate = await GATERS[gater](GATE_PROMPT, message).catch((error: unknown) => {
          console.error(`FAILED ${id}: ${error instanceof Error ? error.message : String(error)}`);
          return undefined;
        });
        Object.assign(results, gate === undefined ? {} : { [id]: gate });
      }
      if (results[id] === undefined) {
        continue;
      }
      const shown = results[id]!.verdict === "worth_showing";
      const counts = tally[gater];
      counts.total += 1;
      counts.agree += shown === (row.owner === "glad") ? 1 : 0;
      if (row.owner === "glad") {
        counts.glad += 1;
        counts.gladKept += shown ? 1 : 0;
      } else {
        counts.obvious += 1;
        counts.obviousKept += shown ? 1 : 0;
      }
    }
    await writeFile(resultsPath, `${JSON.stringify(results, null, 1)}\n`);
  }
  const lines = [
    "| Gate | Agrees with owner | Owner's glad ones kept | Owner's obvious ones kept | Cost per insight |",
    "|---|---|---|---|---|",
  ];
  for (const gater of Object.keys(GATERS) as GaterName[]) {
    const counts = tally[gater];
    const costs = Object.entries(results).filter(([id]) => id.startsWith(`${gater}:`));
    const mean = costs.reduce((sum, [, item]) => sum + item.costDollars, 0) / Math.max(1, costs.length);
    lines.push(
      `| ${gater} | ${share(counts.agree, counts.total)} | ${share(counts.gladKept, counts.glad)} | ${share(counts.obviousKept, counts.obvious)} | $${mean.toFixed(5)} |`,
    );
  }
  lines.push("", `Spent $${spentGate().toFixed(4)}.`);
  console.log(lines.join("\n"));
};

const REFRESHES = 3;
const QUESTIONS_PER_REFRESH = 6;
const LIBRARY_QUESTIONS_MAX = 3;
const PROJECT_QUESTIONS_MAX = 2;
const PROJECTS_PER_REFRESH = 2;
const LIBRARY_PAIRS_LABELLED = 8;
const PROJECT_PAIRS_LABELLED = 4;
const TENSIONS = new Set(["different_view", "contradicts"]);

interface Scope {
  id: string;
  name: string;
  purpose: string | null;
  members: string[];
}

interface ScopedPair {
  scope: string;
  candidate: Candidate;
  label: LabelV2 & Priced;
}

const WrittenQuestions = z.object({
  questions: z.array(z.object({ pair: z.number(), question: z.string() })),
});

interface Results4 {
  labels: Record<string, LabelV2 & Priced>;
  refreshes: Array<{ pairs: Array<{ scope: string; key: string }>; written: z.infer<typeof WrittenQuestions> & Priced; labelCost: number }>;
}

const QUESTION_PROMPT = `You suggest questions a reader could ask about their own library of overviews of videos, articles and podcasts. Each question rests on a pair of overviews whose ideas connect, and is meant to make the reader glad they kept both. You see what is known about the reader, their projects, then numbered pairs, each marked with where the question will be shown: their whole library, or one project's chat.

Write at most ${QUESTIONS_PER_REFRESH} questions: at most ${LIBRARY_QUESTIONS_MAX} for the library and at most ${PROJECT_QUESTIONS_MAX} for each project. Fewer is better than weak: skip any pair whose only question is obvious.

A good question:
- asks about something neither overview settles alone: advice that clashes and what decides between it, a rule from one subject that might carry over to another, or a concrete decision it opens up.
- for a project, points at a decision in that project's purpose.
- stands alone: it names the two ideas in plain words, and any term in it is clear without looking it up.
- is one sentence, about ${FOLLOW_UP_QUESTION_TARGET_WORDS} words and never more than ${FOLLOW_UP_QUESTION_MAX_WORDS}, and is a real question the reader would type into a chat. Name each idea in a few words; leave the detail to the answer.
An obvious question asks about a theme the two share, well-known advice, or whether one thing needs another done well. The reader found ideas like these obvious:
{OBVIOUS}

pair: the number of the pair the question rests on.`;

const scopesOf = async (dataDir: string, entries: Map<string, Entry>): Promise<Scope[]> => {
  const raw = JSON.parse(await readFile(join(dataDir, "profile", "library.json"), "utf-8")) as {
    projects: Array<{ schemaVersion: number; body: unknown }>;
    projectMembers: Array<{ body: { projectId: string; overviewId: string; removedAt: string | null } }>;
  };
  return raw.projects.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body as Record<string, unknown>, row.schemaVersion), Project, PROJECT_MIGRATIONS);
    if (read.status !== "read" || read.record.archivedAt !== null) {
      return [];
    }
    const members = raw.projectMembers
      .filter((member) => member.body.projectId === read.record.id && member.body.removedAt === null && entries.has(member.body.overviewId))
      .map((member) => member.body.overviewId);
    return members.length < 2 ? [] : [{ id: read.record.id, name: read.record.name, purpose: read.record.purpose, members }];
  });
};

const savedAtOf = (entry: Entry): string => (entry.overview as unknown as { savedAt?: string }).savedAt ?? "";

const projectCandidates = (entries: Map<string, Entry>, scope: Scope): Candidate[] => {
  const rows: Candidate[] = [];
  for (const [index, left] of scope.members.entries()) {
    for (const right of scope.members.slice(index + 1)) {
      const match = bestPair(entries.get(left)!, entries.get(right)!, CONNECTING);
      rows.push({
        key: pairKey(left, right),
        a: left,
        b: right,
        origin: "embedding",
        rank: null,
        score: match.score,
        bigPictureScore: 0,
        aClaim: match.a,
        bClaim: match.b,
        wordOverlap: 0,
        sharedTopic: false,
      });
    }
  }
  return rows.sort((x, y) => y.score - x.score);
};

const libraryPool = async (dataDir: string, entries: Map<string, Entry>): Promise<Candidate[]> => {
  const first = JSON.parse(await readFile(join(dataDir, "candidates.json"), "utf-8")) as Candidate[];
  const second = JSON.parse(await readFile(join(dataDir, "candidates2.json"), "utf-8")) as Candidate2[];
  const recency = (candidate: Candidate) => [savedAtOf(entries.get(candidate.a)!), savedAtOf(entries.get(candidate.b)!)].sort().at(-1)!;
  const byRecency = (rows: Candidate[]) => [...rows].sort((x, y) => recency(y).localeCompare(recency(x)));
  const similar = byRecency(first.filter((candidate) => candidate.origin !== "embedding"));
  const cross = byRecency(second.filter((candidate) => candidate.crossTopic));
  const near = byRecency(first.filter((candidate) => candidate.origin === "embedding" && !candidate.sharedTopic));
  const pool: Candidate[] = [];
  for (let index = 0; pool.length < similar.length + cross.length + near.length; index += 1) {
    for (const rows of [similar, cross, near]) {
      if (rows[index] !== undefined) {
        pool.push(rows[index]!);
      }
    }
    if (index > 1_000) {
      break;
    }
  }
  return pool.filter((candidate) => entries.has(candidate.a) && entries.has(candidate.b));
};

const compactNote = (entry: Entry, claimId: string): string =>
  `"${entry.title}": ${entry.overview.coreClaim}${claimId === "core" ? "" : ` Closest point: ${claimText(entry, claimId)}`}`;

const obviousExamplesOf = async (dataDir: string): Promise<string> => {
  const results3 = await loadResults3(join(dataDir, "results3.json"));
  const marks = JSON.parse(await readFile(join(dataDir, "owner-answers3.json"), "utf-8")) as OwnerMark3[];
  return marks
    .flatMap((mark) =>
      (["sonnet", "opus"] as const)
        .filter((writer) => mark[writer].verdict === "obvious")
        .map((writer) => results3.insights[writer][mark.key]?.insight ?? ""),
    )
    .filter((text) => text !== "")
    .slice(0, 4)
    .map((text) => `- ${text}`)
    .join("\n");
};

const writeQuestions = (
  entries: Map<string, Entry>,
  scopes: Scope[],
  reader: string,
  obvious: string,
  projectsNow: Scope[],
  chosen: ScopedPair[],
) => {
  const scopeName = (id: string) =>
    id === "library" ? "the whole library" : `the project "${scopes.find((scope) => scope.id === id)!.name}"`;
  const projectLines = projectsNow.map((scope) => `- ${scope.name}${scope.purpose === null ? "" : `: ${scope.purpose}`}`).join("\n");
  const pairsText = chosen
    .map(
      (row, index) =>
        `## Pair ${index + 1}, for ${scopeName(row.scope)} (${row.label.relation.replace(/_/g, " ")})\n- A: ${compactNote(entries.get(row.candidate.a)!, row.candidate.aClaim)}\n- B: ${compactNote(entries.get(row.candidate.b)!, row.candidate.bClaim)}`,
    )
    .join("\n\n");
  return anthropicJson(
    QUESTION_PROMPT.replace("{OBVIOUS}", obvious),
    `${reader}\n\n# Projects in this round\n${projectLines}\n\n${pairsText}`,
    WrittenQuestions,
    WRITERS.sonnet,
  );
};

const questionsRun = async (dataDir: string, budget: number): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const reader = await readerBlockOf(dataDir);
  const scopes = await scopesOf(dataDir, entries);
  const pool = await libraryPool(dataDir, entries);
  const obvious = await obviousExamplesOf(dataDir);
  const resultsPath = join(dataDir, "questions.json");
  const results = JSON.parse(await readFile(resultsPath, "utf-8").catch(() => '{"labels":{},"refreshes":[]}')) as Results4;
  const spent = () =>
    Object.values(results.labels).reduce((sum, item) => sum + item.costDollars, 0) +
    results.refreshes.reduce((sum, item) => sum + item.written.costDollars, 0);
  const used = new Set(results.refreshes.flatMap((refresh) => refresh.pairs.map((pair) => `${pair.scope}:${pair.key}`)));
  const label = async (candidate: Candidate, scope: Scope | null): Promise<LabelV2 & Priced> => {
    const id = `${scope?.id ?? "library"}:${candidate.key}`;
    const context =
      scope === null
        ? reader
        : `${reader}\n\n# This is for the project "${scope.name}"${scope.purpose === null ? "" : `: ${scope.purpose}`}`;
    results.labels[id] ??= await openAiJson(LABEL_PROMPT_V2, `${context}\n\n${pairMessage(entries, candidate)}`, LabelV2);
    return results.labels[id]!;
  };
  const strongest = (rows: ScopedPair[]) =>
    rows
      .filter((row) => row.label.verdict === "real")
      .sort((x, y) => Number(TENSIONS.has(y.label.relation)) - Number(TENSIONS.has(x.label.relation)));

  for (let refresh = results.refreshes.length; refresh < REFRESHES; refresh += 1) {
    if (spent() >= budget) {
      console.error(`stopped at the budget, $${spent().toFixed(4)}`);
      break;
    }
    const before = spent();
    const libraryRows = pool.filter((candidate) => !used.has(`library:${candidate.key}`)).slice(0, LIBRARY_PAIRS_LABELLED);
    const chosen: ScopedPair[] = [];
    const libraryLabelled: ScopedPair[] = [];
    for (const candidate of libraryRows) {
      libraryLabelled.push({ scope: "library", candidate, label: await label(candidate, null) });
      used.add(`library:${candidate.key}`);
    }
    chosen.push(...strongest(libraryLabelled).slice(0, LIBRARY_QUESTIONS_MAX + 1));
    const projectsNow = [0, 1]
      .map((offset) => scopes[(refresh * PROJECTS_PER_REFRESH + offset) % scopes.length]!)
      .filter((scope, index, all) => all.indexOf(scope) === index);
    for (const scope of projectsNow) {
      const rows = projectCandidates(entries, scope)
        .filter((candidate) => !used.has(`${scope.id}:${candidate.key}`))
        .slice(0, PROJECT_PAIRS_LABELLED);
      const labelled: ScopedPair[] = [];
      for (const candidate of rows) {
        labelled.push({ scope: scope.id, candidate, label: await label(candidate, scope) });
        used.add(`${scope.id}:${candidate.key}`);
      }
      chosen.push(...strongest(labelled).slice(0, PROJECT_QUESTIONS_MAX + 1));
    }
    const labelCost = spent() - before;
    const written = await writeQuestions(entries, scopes, reader, obvious, projectsNow, chosen);
    results.refreshes.push({ pairs: chosen.map((row) => ({ scope: row.scope, key: row.candidate.key })), written, labelCost });
    await writeFile(resultsPath, `${JSON.stringify(results, null, 1)}\n`);
    console.error(
      `refresh ${refresh + 1}: ${libraryRows.length} library + ${projectsNow.map((scope) => scope.name).join(", ")}; ${chosen.length} pairs kept; ${written.questions.length} questions; labels $${labelCost.toFixed(4)}, writing $${written.costDollars.toFixed(4)}`,
    );
  }
  const total = results.refreshes.map((refresh) => refresh.labelCost + refresh.written.costDollars);
  console.error(
    `spent $${spent().toFixed(4)}; a refresh costs $${(total.reduce((sum, cost) => sum + cost, 0) / Math.max(1, total.length)).toFixed(4)} on average`,
  );
};

const questionsRewrite = async (dataDir: string, budget: number): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const reader = await readerBlockOf(dataDir);
  const scopes = await scopesOf(dataDir, entries);
  const pool = new Map((await libraryPool(dataDir, entries)).map((candidate) => [candidate.key, candidate]));
  const obvious = await obviousExamplesOf(dataDir);
  const source = JSON.parse(await readFile(join(dataDir, "questions.json"), "utf-8")) as Results4;
  const resultsPath = join(dataDir, "questions-short.json");
  const results: Results4 = JSON.parse(
    await readFile(resultsPath, "utf-8").catch(() => JSON.stringify({ labels: source.labels, refreshes: [] })),
  );
  const spent = () => results.refreshes.reduce((sum, item) => sum + item.written.costDollars, 0);
  for (let refresh = results.refreshes.length; refresh < source.refreshes.length; refresh += 1) {
    if (spent() >= budget) {
      console.error(`stopped at the budget, $${spent().toFixed(4)}`);
      break;
    }
    const pairs = source.refreshes[refresh]!.pairs;
    const projectsNow = scopes.filter((scope) => pairs.some((pair) => pair.scope === scope.id));
    const chosen: ScopedPair[] = pairs.map((pair) => {
      const scope = scopes.find((row) => row.id === pair.scope);
      const candidate = scope === undefined ? pool.get(pair.key)! : projectCandidates(entries, scope).find((row) => row.key === pair.key)!;
      return { scope: pair.scope, candidate, label: source.labels[`${pair.scope}:${pair.key}`]! };
    });
    const written = await writeQuestions(entries, scopes, reader, obvious, projectsNow, chosen);
    results.refreshes.push({ pairs, written, labelCost: source.refreshes[refresh]!.labelCost });
    await writeFile(resultsPath, `${JSON.stringify(results, null, 1)}\n`);
    const words = written.questions.map((question) => question.question.split(/\s+/).length);
    console.error(
      `refresh ${refresh + 1}: ${written.questions.length} questions, words ${words.join(",")}; writing $${written.costDollars.toFixed(4)}, output ${written.usage?.outputTokens ?? "?"} tokens`,
    );
  }
  console.error(`spent $${spent().toFixed(4)} on writing`);
};

const questionsPage = async (dataDir: string, name = "questions"): Promise<void> => {
  const entries = await loadLibrary(dataDir);
  const scopes = await scopesOf(dataDir, entries);
  const results = JSON.parse(await readFile(join(dataDir, `${name}.json`), "utf-8")) as Results4;
  const radios = (name: string, options: Array<[string, string]>) =>
    options.map(([value, text]) => `<label><input type="radio" name="${name}" value="${value}"> ${text}</label>`).join("");
  const items = results.refreshes.flatMap((refresh, refreshIndex) =>
    refresh.written.questions.flatMap((question) => {
      const pair = refresh.pairs[question.pair - 1];
      return pair === undefined ? [] : [{ refreshIndex, question: question.question, ...pair }];
    }),
  );
  const cards = items
    .map((item, index) => {
      const scope = item.scope === "library" ? "Whole library" : `Project: ${scopes.find((row) => row.id === item.scope)?.name ?? "?"}`;
      const [a, b] = item.key.split("|").map((id) => entries.get(id)!);
      return `<section class="pair" data-key="${item.scope}:${item.key}" data-refresh="${item.refreshIndex + 1}">
<p class="scope">${escapeHtml(scope)} · refresh ${item.refreshIndex + 1}</p>
<p class="question">${escapeHtml(item.question)}</p>
<details><summary>The two overviews it rests on</summary><p><b>${escapeHtml(a!.title)}</b>: ${escapeHtml(a!.overview.coreClaim)}</p><p><b>${escapeHtml(b!.title)}</b>: ${escapeHtml(b!.overview.coreClaim)}</p></details>
<fieldset><legend>This question is…</legend>${radios(`q${index}`, [
        ["glad", "One I'd be glad to ask"],
        ["obvious", "Obvious or pointless"],
        ["wrong", "Wrong about an overview"],
      ])}</fieldset>
<textarea placeholder="Anything else (optional)" rows="2"></textarea>
</section>`;
    })
    .join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Suggested questions</title>
<style>
:root{--bg:#faf9f6;--fg:#1d1c1a;--muted:#6b6862;--card:#fff;--line:#e3e0da;--accent:#2f5d50}
@media (prefers-color-scheme: dark){:root{--bg:#171614;--fg:#ece9e3;--muted:#a19d95;--card:#211f1c;--line:#3a3732;--accent:#8fc1b1}}
body{background:var(--bg);color:var(--fg);font:1rem/1.5 system-ui,sans-serif;margin:0;padding:1rem}
main{max-width:48rem;margin:0 auto}
.pair{background:var(--card);border:1px solid var(--line);border-radius:.75rem;padding:1rem;margin:1rem 0}
.scope{color:var(--muted);margin:0;font-size:.875rem}.question{font-size:1.15rem;margin:.35rem 0 .5rem}
details{color:var(--muted);margin:.25rem 0}
fieldset{border:0;padding:0;margin:.5rem 0}legend{font-weight:600;margin-bottom:.25rem}
label{display:inline-flex;gap:.35rem;margin:.25rem 1rem .25rem 0;align-items:center}
textarea{width:100%;box-sizing:border-box;font:inherit;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:.5rem;padding:.5rem;margin-top:.5rem}
button{font:inherit;padding:.6rem 1rem;border-radius:.5rem;border:0;background:var(--accent);color:var(--bg);cursor:pointer}
#out{min-height:6rem}
</style></head><body><main>
<h1>Suggested questions</h1>
<p>These are the questions three refreshes would have put in your library and project chats. Would you be glad to ask each one? The overviews behind a question are under it if you want to check. When you're done, press the button at the bottom and paste the text back to Claude.</p>
${cards}
<p><button id="copy" type="button">Copy my answers</button></p>
<textarea id="out" readonly aria-label="Your answers"></textarea>
</main>
<script>
document.getElementById("copy").addEventListener("click", async () => {
  const answers = [...document.querySelectorAll(".pair")].map((pair, index) => ({ key: pair.dataset.key, verdict: pair.querySelector('input[name="q' + index + '"]:checked')?.value ?? null, note: pair.querySelector("textarea").value }));
  const text = JSON.stringify(answers);
  document.getElementById("out").value = text;
  try { await navigator.clipboard.writeText(text); document.getElementById("copy").textContent = "Copied"; } catch { document.getElementById("copy").textContent = "Copy the text below"; }
});
</script></body></html>
`;
  await writeFile(join(dataDir, `${name}.html`), html);
  console.error(`${items.length} questions → ${join(dataDir, `${name}.html`)}`);
};

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { limit: { type: "string", default: "30" }, budget: { type: "string", default: "1" } },
});
const [command, dataDir] = positionals;
const usage =
  "usage: connectionsCheck candidates <data dir> | run <data dir> [--limit 30] [--budget 1] | report <data dir> | review <data dir> | candidates2 <data dir> | run2 <data dir> [--budget 1] | report2 <data dir> | review-page <data dir> | run3 <data dir> [--budget 1] | report3 <data dir> | review-page3 <data dir> | gate <data dir> [--budget 1] | questions <data dir> [--budget 1] | questions-page <data dir> | questions-short <data dir> [--budget 1] | questions-short-page <data dir>";
if (dataDir === undefined) {
  console.error(usage);
  process.exit(1);
}
if (command === "candidates") {
  await candidatesCommand(dataDir);
} else if (command === "run") {
  await run(dataDir, Number(values.limit), Number(values.budget));
} else if (command === "report") {
  await report(dataDir);
} else if (command === "review") {
  await review(dataDir);
} else if (command === "candidates2") {
  await candidates2Command(dataDir);
} else if (command === "run2") {
  await run2(dataDir, Number(values.budget));
} else if (command === "report2") {
  await report2(dataDir);
} else if (command === "review-page") {
  await reviewPage(dataDir);
} else if (command === "run3") {
  await run3(dataDir, Number(values.budget));
} else if (command === "report3") {
  await report3(dataDir);
} else if (command === "review-page3") {
  await reviewPage3(dataDir);
} else if (command === "gate") {
  await gateCheck(dataDir, Number(values.budget));
} else if (command === "questions") {
  await questionsRun(dataDir, Number(values.budget));
} else if (command === "questions-page") {
  await questionsPage(dataDir);
} else if (command === "questions-short") {
  await questionsRewrite(dataDir, Number(values.budget));
} else if (command === "questions-short-page") {
  await questionsPage(dataDir, "questions-short");
} else {
  console.error(usage);
  process.exit(1);
}
