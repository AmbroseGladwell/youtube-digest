import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiLogLines, ShareToken } from "@overview/domain";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { shareCardPng } from "./shareCard.js";
import { goneHead, sharePageHead } from "./sharePageHead.js";
import { sharePageHtml } from "./sharePageHtml.js";
import type { SharesRepository } from "./SharesRepository.js";

export interface SharePagePluginOptions {
  shares: SharesRepository;
  appUrl: string;
  staticRoot: string | null;
  clock: () => Date;
}

const GONE = {
  revoked: { status: 410, title: "No longer shared" },
  unknown: { status: 404, title: "Link not found" },
} as const;

type Missing = keyof typeof GONE;

const tokenOf = (request: FastifyRequest): ShareToken | null => {
  const { token } = request.params as { token?: string };
  return ShareToken.safeParse(token).data ?? null;
};

// The API writes the document, the app renders the page: docs/features/sharing.md, "The page".
export const sharePagePlugin = async (app: FastifyInstance, options: SharePagePluginOptions): Promise<void> => {
  const { shares, appUrl, staticRoot, clock } = options;
  const shell = staticRoot === null ? null : await readFile(join(staticRoot, "index.html"), "utf8");
  const limit = rateLimitHook(rateLimits.sharePagePerAddress, (request) => request.clientAddress, clock);

  // A mistyped link and one never issued are the same to its holder, so both get the page.
  const gone = (reply: FastifyReply, state: Missing) => {
    reply.request.log.info(apiLogLines.shares.pageMissing({ state }));
    const { status, title } = GONE[state];
    return reply
      .status(status)
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(sharePageHtml({ head: goneHead(title), payload: { state }, shell }));
  };

  app.get("/:token", { preHandler: limit }, async (request, reply) => {
    const token = tokenOf(request);
    const found = token === null ? null : await shares.readAndCount(token);
    if (token === null || found === null) {
      return gone(reply, "unknown");
    }
    if (found === "revoked") {
      return gone(reply, "revoked");
    }
    request.log.info(apiLogLines.shares.viewed());
    return reply
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(
        sharePageHtml({
          head: sharePageHead({
            note: found.snapshot.note,
            token,
            appUrl,
            hasNarration: found.snapshot.narration !== null,
          }),
          payload: { state: "shared", token, sharedAt: found.sharedAt, snapshot: found.snapshot },
          shell,
        }),
      );
  });

  // Peeked, so one unfurl counts one visit: docs/features/sharing.md, "Counting".
  app.get("/:token/card.png", { preHandler: limit }, async (request, reply) => {
    const token = tokenOf(request);
    const found = token === null ? null : await shares.peek(token);
    if (found === null || found === "revoked") {
      return reply
        .status(GONE[found === null ? "unknown" : "revoked"].status)
        .header("cache-control", "no-store")
        .send();
    }
    return reply
      .header("content-type", "image/png")
      .header("cache-control", "no-store")
      .send(await shareCardPng(found.snapshot.note));
  });

  // One stable address for og:audio: docs/features/sharing.md, "The audio".
  app.get("/:token/audio.mp3", { preHandler: limit }, async (request, reply) => {
    const token = tokenOf(request);
    const found = token === null ? null : await shares.peek(token);
    if (found === null || found === "revoked") {
      return reply
        .status(GONE[found === null ? "unknown" : "revoked"].status)
        .header("cache-control", "no-store")
        .send();
    }
    const { narration } = found.snapshot;
    if (narration === null) {
      return reply.status(404).header("cache-control", "no-store").send();
    }
    return reply.redirect(`/api/audio/${narration.key}/file`, 302);
  });
};
