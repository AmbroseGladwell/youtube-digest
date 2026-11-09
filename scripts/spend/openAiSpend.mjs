import { EXPECTED_SPEND, ENVIRONMENTS, spendKey } from "./expectedSpend.mjs";
import { ProviderReadError } from "./ProviderReadError.mjs";

const OPENAI_API = "https://api.openai.com/v1/organization";
const DAY_SECONDS = 86_400;

export function environmentOfProject(name) {
  const words = name.toLowerCase().split(/[^a-z0-9]+/);
  return ENVIRONMENTS.find((environment) => words.at(-1) === environment || words[0] === environment) ?? "unattributed";
}

export function areaOfLineItem(lineItem) {
  return /embedding/i.test(lineItem ?? "") ? "embeddings" : "generation";
}

export function openAiRowsOf({ projects, buckets }) {
  const environmentOf = new Map(projects.map((project) => [project.id, environmentOfProject(project.name)]));
  const totals = new Map();
  for (const bucket of buckets) {
    const date = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
    for (const expected of EXPECTED_SPEND.filter((spend) => spend.provider === "openai")) {
      totals.set(`${date}|${spendKey(expected)}`, { date, ...expected, dollars: 0 });
    }
    for (const result of bucket.results) {
      const environment = environmentOf.get(result.project_id) ?? "unattributed";
      const row = { date, provider: "openai", environment, area: areaOfLineItem(result.line_item) };
      const key = `${date}|${spendKey(row)}`;
      const total = totals.get(key) ?? { ...row, dollars: 0 };
      total.dollars += Number(result.amount.value);
      totals.set(key, total);
    }
  }
  return [...totals.values()].map((row) => ({ ...row, source: "bill" }));
}

async function readJson(fetch, url, adminKey) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" } });
  if (!response.ok) throw new ProviderReadError(`OpenAI answered ${response.status}`);
  return response.json();
}

async function allProjects(fetch, adminKey) {
  const projects = [];
  let after = null;
  do {
    const page = await readJson(
      fetch,
      `${OPENAI_API}/projects?limit=100&include_archived=true${after === null ? "" : `&after=${after}`}`,
      adminKey,
    );
    projects.push(...page.data);
    after = page.has_more ? page.last_id : null;
  } while (after !== null);
  return projects;
}

async function allCostBuckets(fetch, adminKey, from, to) {
  const startTime = Date.parse(`${from}T00:00:00Z`) / 1000;
  const endTime = Date.parse(`${to}T00:00:00Z`) / 1000 + DAY_SECONDS;
  const buckets = [];
  let page = null;
  do {
    const query = `start_time=${startTime}&end_time=${endTime}&bucket_width=1d&group_by=project_id&group_by=line_item&limit=180`;
    const body = await readJson(fetch, `${OPENAI_API}/costs?${query}${page === null ? "" : `&page=${page}`}`, adminKey);
    buckets.push(...body.data);
    page = body.has_more ? body.next_page : null;
  } while (page !== null);
  return buckets;
}

export async function openAiSpend({ adminKey, fetch, from, to }) {
  const [projects, buckets] = await Promise.all([allProjects(fetch, adminKey), allCostBuckets(fetch, adminKey, from, to)]);
  return openAiRowsOf({ projects, buckets });
}
