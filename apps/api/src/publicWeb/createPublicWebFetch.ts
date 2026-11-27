import { lookup as resolve, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch, type Dispatcher, type Response } from "undici";
import { isPublicAddress } from "./isPublicAddress.js";

export type PublicWebAnswer =
  | { status: "answered"; url: string; response: Response }
  | { status: "failed"; reason: "closed" | "blocked" | "missing" | "no-answer"; httpStatus?: number; retryAfterSeconds?: number };

export interface PublicWebFetchOptions {
  isAllowedAddress?: (address: string) => boolean;
  allowedPorts?: readonly string[];
  timeoutMs?: number;
  userAgent?: string;
}

export interface PublicWebRequest {
  accept: string;
  headers?: Record<string, string>;
}

const TIMEOUT_MS = 20_000;
const MOST_REDIRECTS = 5;
const WEB_PORTS: readonly string[] = ["", "80", "443"];
const REFUSED_STATUSES = new Set([401, 402, 403, 407, 429, 451]);
const MISSING_STATUSES = new Set([404, 410]);
export const PUBLIC_WEB_USER_AGENT = "TheOverview/1.0 (fetches a link a reader pasted; +https://theoverview.app)";
export const FEED_USER_AGENT = "TheOverview/1.0 (feed reader for people who follow this feed; +https://theoverview.app)";
const NOT_MODIFIED = 304;

export const retryAfterSecondsOf = (value: string | null, now: number): number | undefined => {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  if (/^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
};

class ClosedAddressError extends Error {}

const reasonOf = (httpStatus: number): "blocked" | "missing" | "no-answer" => {
  if (REFUSED_STATUSES.has(httpStatus)) {
    return "blocked";
  }
  return MISSING_STATUSES.has(httpStatus) ? "missing" : "no-answer";
};

const failureOf = (response: Response): PublicWebAnswer => {
  const httpStatus = response.status;
  const retryAfterSeconds = retryAfterSecondsOf(response.headers.get("retry-after"), Date.now());
  return {
    status: "failed",
    reason: reasonOf(httpStatus),
    httpStatus,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
};

// Checked on connecting, because a name checked first can answer differently the second time.
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

export const readBodyText = async (response: Response, mostBytes: number): Promise<string | null> => {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return "";
  }
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
};

// The guards: docs/features/pasted-article-links.md, "What the server will fetch".
export const createPublicWebFetch = ({
  isAllowedAddress = isPublicAddress,
  allowedPorts = WEB_PORTS,
  timeoutMs = TIMEOUT_MS,
  userAgent = PUBLIC_WEB_USER_AGENT,
}: PublicWebFetchOptions = {}) => {
  const dispatcher: Dispatcher = new Agent({ connect: { lookup: guardedLookup(isAllowedAddress) } });

  const mayVisit = ({ protocol, port, hostname, username, password }: URL): boolean => {
    if (protocol !== "http:" && protocol !== "https:") {
      return false;
    }
    if (username !== "" || password !== "" || !allowedPorts.includes(port)) {
      return false;
    }
    const host = hostname.replace(/^\[|\]$/g, "");
    return isIP(host) === 0 || isAllowedAddress(host);
  };

  return async function fetchPublicWeb(link: string, { accept, headers = {} }: PublicWebRequest): Promise<PublicWebAnswer> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      let url = new URL(link);
      for (let hop = 0; hop <= MOST_REDIRECTS; hop += 1) {
        if (!mayVisit(url)) {
          return { status: "failed", reason: "closed" };
        }
        const response = await undiciFetch(url, {
          dispatcher,
          signal,
          redirect: "manual",
          headers: { ...headers, accept, "user-agent": userAgent },
        });
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location !== null) {
          await response.body?.cancel();
          url = new URL(location, url);
          continue;
        }
        if (response.status === NOT_MODIFIED) {
          await response.body?.cancel();
          return { status: "answered", url: url.href, response };
        }
        if (!response.ok) {
          await response.body?.cancel();
          return failureOf(response);
        }
        return { status: "answered", url: url.href, response };
      }
      return { status: "failed", reason: "no-answer" };
    } catch (error) {
      const cause = error instanceof Error ? error.cause : null;
      return { status: "failed", reason: cause instanceof ClosedAddressError ? "closed" : "no-answer" };
    }
  };
};
