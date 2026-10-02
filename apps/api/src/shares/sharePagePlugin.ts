import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ShareToken } from "@overview/domain";
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

// The shared copy's own document, outside /api and outside the session plugin. The head is
// written here so a preview in Messages or Slack has something to read; the page itself is
// the app in read-only mode, booting from the copy already in the document
// (docs/features/sharing.md).
export async function sharePagePlugin(app: FastifyInstance, options: SharePagePluginOptions): Promise<void> {
  const { shares, appUrl, staticRoot, clock } = options;
  const shell = staticRoot === null ? null : await readFile(join(staticRoot, "index.html"), "utf8");
  const limit = rateLimitHook(rateLimits.sharePagePerAddress, (request) => request.clientAddress, clock);

  // A mistyped link and a link that was never issued are the same thing to the person
  // holding it, so both get the page rather than the API's envelope.
  const gone = (reply: FastifyReply, state: Missing) => {
    reply.request.log.info({ state }, "share page missing");
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
    request.log.info("share viewed");
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

  // Peeked rather than read, here and for the audio: a service unfurling a link fetches the
  // page, then the card, and sometimes the audio, and one visit should count once.
  //
  // The card is drawn per request rather than stored, so replacing the copy behind a link
  // leaves nothing stale to invalidate.
  app.get("/:token/card.png", { preHandler: limit }, async (request, reply) => {
    const token = tokenOf(request);
    const found = token === null ? null : await shares.peek(token);
    if (found === null || found === "revoked") {
      return reply.status(GONE[found === null ? "unknown" : "revoked"].status).header("cache-control", "no-store").send();
    }
    return reply
      .header("content-type", "image/png")
      .header("cache-control", "no-store")
      .send(await shareCardPng(found.snapshot.note));
  });

  // og:audio wants one stable address per link. The bytes live where every other render
  // does, content-addressed and already public, so this only says where.
  app.get("/:token/audio.mp3", { preHandler: limit }, async (request, reply) => {
    const token = tokenOf(request);
    const found = token === null ? null : await shares.peek(token);
    if (found === null || found === "revoked") {
      return reply.status(GONE[found === null ? "unknown" : "revoked"].status).header("cache-control", "no-store").send();
    }
    const { narration } = found.snapshot;
    if (narration === null) {
      return reply.status(404).header("cache-control", "no-store").send();
    }
    return reply.redirect(`/api/audio/${narration.key}/file`, 302);
  });
}
