import { lookup as resolve, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import type { ArticleRead } from "@overview/domain";
import { Agent, fetch as undiciFetch, type Dispatcher } from "undici";
import { isPublicAddress } from "./isPublicAddress.js";

type ArticleFailure = Extract<ArticleRead, { status: "failed" }>;
export type FetchedPage = { status: "page"; url: string; html: string } | ArticleFailure;

const TIMEOUT_MS = 20_000;
const MOST_BYTES = 3 * 1024 * 1024;
const MOST_REDIRECTS = 5;
const WEB_PORTS: readonly string[] = ["", "80", "443"];
const REFUSED_STATUSES = new Set([401, 402, 403, 407, 429, 451]);
const MISSING_STATUSES = new Set([404, 410]);
export const ARTICLE_FETCH_USER_AGENT = "TheOverview/1.0 (fetches a link a reader pasted; +https://theoverview.app)";

class ClosedAddressError extends Error {}

const failed = (reason: ArticleFailure["reason"]): ArticleFailure => ({ status: "failed", reason });

export interface ArticlePageFetcherOptions {
  isAllowedAddress?: (address: string) => boolean;
  allowedPorts?: readonly string[];
  timeoutMs?: number;
  mostBytes?: number;
}

// The address is checked at the moment of connecting, on what the connection will really use,
// because a name checked first can answer differently the second time.
const guardedLookup =
  (isAllowed: (address: string) => boolean): LookupFunction =>
  (hostname, options, callback) => {
    resolve(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
      if (error) {
        callback(error, "", 0);
        return;
      }
      if (addresses.length === 0 || !addresses.every(({ address }) => isAllowed(address))) {
        callback(new ClosedAddressError(hostname), "", 0);
        return;
      }
      if (options.all === true) {
        (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, addresses);
        return;
      }
      const [first] = addresses;
      callback(null, first!.address, first!.family);
    });
  };

async function readBody(response: Awaited<ReturnType<typeof undiciFetch>>, mostBytes: number): Promise<string | null> {
  const reader = response.body?.getReader();
  if (reader === undefined) return "";
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    bytes += read.value.byteLength;
    if (bytes > mostBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(read.value);
  }
  const charset = /charset=["']?([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1];
  const decoder = (() => {
    try {
      return new TextDecoder(charset ?? "utf-8");
    } catch {
      return new TextDecoder("utf-8");
    }
  })();
  return decoder.decode(Buffer.concat(chunks));
}

// Fetches a link a reader pasted, which makes it an address chosen by a stranger: the checks
// here are the whole of what stops it reaching anything but the public web
// (docs/features/pasted-article-links.md). No cookies or credentials are ever sent.
export function createArticlePageFetcher({
  isAllowedAddress = isPublicAddress,
  allowedPorts = WEB_PORTS,
  timeoutMs = TIMEOUT_MS,
  mostBytes = MOST_BYTES,
}: ArticlePageFetcherOptions = {}) {
  const dispatcher: Dispatcher = new Agent({ connect: { lookup: guardedLookup(isAllowedAddress) } });

  const mayVisit = ({ protocol, port, hostname, username, password }: URL): boolean => {
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (username !== "" || password !== "" || !allowedPorts.includes(port)) return false;
    const host = hostname.replace(/^\[|\]$/g, "");
    return isIP(host) === 0 || isAllowedAddress(host);
  };

  return async function fetchArticlePage(link: string): Promise<FetchedPage> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      let url = new URL(link);
      for (let hop = 0; hop <= MOST_REDIRECTS; hop += 1) {
        if (!mayVisit(url)) return failed("not-found");
        const response = await undiciFetch(url, {
          dispatcher,
          signal,
          redirect: "manual",
          headers: { accept: "text/html,application/xhtml+xml", "user-agent": ARTICLE_FETCH_USER_AGENT },
        });
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location !== null) {
          await response.body?.cancel();
          url = new URL(location, url);
          continue;
        }
        if (REFUSED_STATUSES.has(response.status)) return failed("blocked");
        if (MISSING_STATUSES.has(response.status)) return failed("not-found");
        if (!response.ok) return failed("no-answer");
        if (!/\b(text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get("content-type") ?? "")) {
          await response.body?.cancel();
          return failed("nothing-readable");
        }
        const html = await readBody(response, mostBytes);
        return html === null ? failed("nothing-readable") : { status: "page", url: url.href, html };
      }
      return failed("no-answer");
    } catch (error) {
      const cause = error instanceof Error ? error.cause : null;
      return failed(cause instanceof ClosedAddressError ? "not-found" : "no-answer");
    }
  };
}
