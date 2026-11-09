import { ProviderReadError } from "./ProviderReadError.mjs";

const NEON_API = "https://console.neon.tech/api/v2";
const HOUR = 3600;
const GB = 1e9;

export function neonRowsOf({ date, project, branches }) {
  const usage = (quantity, unit) => ({
    date,
    provider: "neon",
    environment: "prod",
    area: "database",
    dollars: null,
    quantity,
    unit,
    source: "usage",
  });
  return [
    usage(project.compute_time_seconds / HOUR, "compute_hours_month_to_date"),
    usage(project.active_time_seconds / HOUR, "active_hours_month_to_date"),
    usage(project.data_transfer_bytes / GB, "transfer_gb_month_to_date"),
    usage(branches.reduce((total, branch) => total + (branch.logical_size ?? 0), 0) / GB, "storage_gb"),
  ];
}

async function readJson(fetch, url, apiKey) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
  if (!response.ok) throw new ProviderReadError(`Neon answered ${response.status}`);
  return response.json();
}

export async function neonUsage({ apiKey, projectId, fetch, date }) {
  const [{ project }, { branches }] = await Promise.all([
    readJson(fetch, `${NEON_API}/projects/${projectId}`, apiKey),
    readJson(fetch, `${NEON_API}/projects/${projectId}/branches`, apiKey),
  ]);
  return neonRowsOf({ date, project, branches });
}
