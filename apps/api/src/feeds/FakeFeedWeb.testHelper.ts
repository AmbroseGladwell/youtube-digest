import { Response } from "undici";
import type { PublicWebAnswer, PublicWebRequest } from "../publicWeb/createPublicWebFetch.js";

export type FakeAnswer =
  | { body: string; type?: string; etag?: string; lastModified?: string }
  | { notModified: true }
  | { failed: Extract<PublicWebAnswer, { status: "failed" }>["reason"]; httpStatus?: number; retryAfterSeconds?: number };

export interface FakeFeedWeb {
  fetch: (url: string, request: PublicWebRequest) => Promise<PublicWebAnswer>;
  answers: Map<string, FakeAnswer>;
  calls: { url: string; headers: Record<string, string> }[];
  hold(): () => void;
}

const answerOf = (url: string, answer: FakeAnswer | undefined): PublicWebAnswer => {
  if (answer === undefined) {
    return { status: "failed", reason: "missing", httpStatus: 404 };
  }
  if ("failed" in answer) {
    return {
      status: "failed",
      reason: answer.failed,
      ...(answer.httpStatus === undefined ? {} : { httpStatus: answer.httpStatus }),
      ...(answer.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: answer.retryAfterSeconds }),
    };
  }
  if ("notModified" in answer) {
    return { status: "answered", url, response: new Response(null, { status: 304 }) };
  }
  const headers: Record<string, string> = { "content-type": answer.type ?? "application/rss+xml" };
  if (answer.etag !== undefined) {
    headers.etag = answer.etag;
  }
  if (answer.lastModified !== undefined) {
    headers["last-modified"] = answer.lastModified;
  }
  return { status: "answered", url, response: new Response(answer.body, { headers }) };
};

export const makeFakeFeedWeb = (): FakeFeedWeb => {
  const answers = new Map<string, FakeAnswer>();
  const calls: FakeFeedWeb["calls"] = [];
  let held: Promise<void> | null = null;
  return {
    answers,
    calls,
    hold() {
      let release = () => {};
      held = new Promise((resolve) => {
        release = resolve;
      });
      return () => {
        held = null;
        release();
      };
    },
    async fetch(url, { headers = {} }) {
      calls.push({ url, headers });
      if (held !== null) {
        await held;
      }
      return answerOf(url, answers.get(url));
    },
  };
};
