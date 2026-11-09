import { ProviderReadError } from "./ProviderReadError.mjs";

const DECODO_TRAFFIC = "https://api.decodo.com/api/v2/statistics/traffic";
const GB = 1e9;
const PAGE_SIZE = 500;

export function decodoRowsOf({ dates, data }) {
  const byDate = new Map(data.map((item) => [item.key.slice(0, 10), item]));
  const usage = (date, quantity, unit) => ({
    date,
    provider: "decodo",
    environment: "prod",
    area: "transcripts",
    dollars: null,
    quantity,
    unit,
    source: "usage",
  });
  return dates.flatMap((date) => {
    const item = byDate.get(date);
    return [usage(date, (item?.rx_tx_bytes ?? 0) / GB, "proxy_traffic_gb"), usage(date, item?.requests ?? 0, "proxy_requests")];
  });
}

export async function decodoUsage({ apiKey, fetch, dates }) {
  const data = [];
  let page = 1;
  let pages = 1;
  do {
    const response = await fetch(DECODO_TRAFFIC, {
      method: "POST",
      headers: { Authorization: apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        proxyType: "residential_proxies",
        startDate: `${dates[0]} 00:00:00`,
        endDate: `${dates.at(-1)} 23:59:59`,
        groupBy: "day",
        limit: PAGE_SIZE,
        page,
      }),
    });
    if (!response.ok) throw new ProviderReadError(`Decodo answered ${response.status}`);
    const body = await response.json();
    data.push(...body.data);
    pages = body.metadata.total_pages;
    page += 1;
  } while (page <= pages);
  return decodoRowsOf({ dates, data });
}
