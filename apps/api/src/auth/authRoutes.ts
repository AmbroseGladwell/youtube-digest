import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  apiLogLines,
  createAccountLink,
  EmailCodeRequest,
  LinkCodeRequest,
  type EmailChangeReverted,
  MagicLinkRequest,
  signInLink,
  SignInRequest,
  type LinkedSession,
  type SignedIn,
} from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { Mailer } from "../mail/Mailer.js";
import type { RateLimit } from "../rateLimit/RateLimit.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { accountExists } from "./accountExists.js";
import { consumeLinkCode } from "./consumeLinkCode.js";
import { consumeMagicLink, consumeMagicLinkCode, type ConsumedMagicLink } from "./consumeMagicLink.js";
import { revertEmailChange } from "./emailChange.js";
import { createSessionForAccount } from "./createSession.js";
import { findAccount } from "./findAccount.js";
import { findOrCreateAccount } from "./findOrCreateAccount.js";
import { issueLinkCode } from "./issueLinkCode.js";
import { issueMagicLink } from "./issueMagicLink.js";
import { normaliseEmail } from "./normaliseEmail.js";
import type { EventSink } from "../events/EventSink.js";
import { sessionCookie } from "./sessionCookie.js";

export interface AuthRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  mailer: Mailer;
  appUrl: string;
  sessionTtlDays: number;
  sessionCookieSecure: boolean;
  eventSink: EventSink | null;
}

const PUBLIC = { config: { public: true } };

const emailOf = (request: FastifyRequest): string | null => {
  const parsed = MagicLinkRequest.safeParse(request.body);
  return parsed.success ? normaliseEmail(parsed.data.email) : null;
};

const codeEmailOf = (request: FastifyRequest): string | null => {
  const parsed = EmailCodeRequest.safeParse(request.body);
  return parsed.success ? normaliseEmail(parsed.data.email) : null;
};

// Every answer here is the same whether or not the address has an account, and an account
// is only ever made by a consumed create-account link. Only the mail differs
// (docs/features/sign-in.md, "Which mail an address gets").
export function authRoutes(
  app: FastifyInstance,
  { sql, clock, mailer, appUrl, sessionTtlDays, sessionCookieSecure, eventSink }: AuthRoutesOptions,
): void {
  const perAddress = (rateLimit: RateLimit) => rateLimitHook(rateLimit, (request) => request.clientAddress, clock);
  const magicLinkLimits = [perAddress(rateLimits.magicLinkPerAddress), rateLimitHook(rateLimits.magicLinkPerEmail, emailOf, clock)];

  app.post("/auth/magic-link", { ...PUBLIC, preHandler: magicLinkLimits }, async (request, reply) => {
    const {
      email,
      surface,
      intent,
      firstName = null,
      returnTo = null,
      anonymousId,
    } = parseOrThrow(MagicLinkRequest, request.body, "The sign-in request");
    const hasAccount = await accountExists(sql, email);
    const sendsLink = hasAccount || intent === "createAccount";
    const issued = await issueMagicLink(sql, {
      email,
      surface,
      intent,
      firstName: sendsLink ? firstName : null,
      anonymousId: sendsLink && intent === "createAccount" ? (anonymousId ?? null) : null,
      spent: !sendsLink,
      now: clock(),
    });
    if (issued === null) {
      request.log.warn(apiLogLines.auth.magicLinkHeldBack({ surface, intent, reason: "cooldown" }));
    } else if (!sendsLink) {
      await mailer.sendAccountMail({ kind: "noAccount", to: issued.email, createAccountLink: createAccountLink(appUrl) });
      request.log.info(apiLogLines.auth.noAccountMailed({ surface }));
    } else {
      const creating = intent === "createAccount" && !hasAccount;
      const purpose = creating ? "createAccount" : "signIn";
      await mailer.sendMagicLink({
        to: issued.email,
        link: signInLink(appUrl, issued.token, surface === "web" ? returnTo : null),
        code: issued.code,
        surface,
        purpose,
        firstName: creating ? firstName : null,
        expiresAt: issued.expiresAt,
      });
      request.log.info(apiLogLines.auth.magicLinkSent({ surface, purpose }));
    }
    return reply.status(202).send({ accepted: true });
  });

  const signInWith = async (link: ConsumedMagicLink, now: Date, request: FastifyRequest, reply: FastifyReply): Promise<SignedIn> => {
    const account =
      link.intent === "createAccount" ? await findOrCreateAccount(sql, link.email, link.firstName) : await findAccount(sql, link.email);
    if (account === null) {
      request.log.warn(apiLogLines.auth.signInRefused({ intent: link.intent, surface: link.surface }));
      throw new ApiError("link_invalid", "There’s no account for this address. Create one to sign in");
    }
    request.log.info(
      (account.created ? apiLogLines.auth.accountCreated : apiLogLines.auth.signedIn)({
        accountId: account.id,
        created: account.created,
        intent: link.intent,
        surface: link.surface,
      }),
    );
    if (account.created && link.anonymousId !== null && eventSink !== null) {
      void eventSink.link(account.id, link.anonymousId, now).then(
        () => request.log.info(apiLogLines.auth.anonymousIdLinked({ accountId: account.id })),
        (error: unknown) => request.log.warn(apiLogLines.auth.anonymousIdNotLinked({ accountId: account.id, error: String(error) })),
      );
    }
    if (link.surface === "extension") {
      const code = await issueLinkCode(sql, account.id, now);
      const signedIn: SignedIn = {
        surface: "extension",
        email: link.email,
        firstName: account.firstName,
        linkCode: code.code,
        linkCodeExpiresAt: code.expiresAt,
      };
      return signedIn;
    }
    const session = await createSessionForAccount(sql, account.id, { now, sessionTtlDays });
    request.log.info(apiLogLines.auth.sessionCreated({ accountId: account.id, sessionId: session.id, surface: "web" }));
    reply.header("set-cookie", sessionCookie(session.token, { expiresAt: session.expiresAt, now, secure: sessionCookieSecure }));
    const signedIn: SignedIn = {
      surface: "web",
      accountId: account.id,
      email: link.email,
      firstName: account.firstName,
      expiresAt: session.expiresAt,
    };
    return signedIn;
  };

  app.post("/auth/sign-in", { ...PUBLIC, preHandler: perAddress(rateLimits.signInPerAddress) }, async (request, reply) => {
    const { token } = parseOrThrow(SignInRequest, request.body, "The sign-in");
    const now = clock();
    const link = await consumeMagicLink(sql, token, now);
    if (link === null) {
      throw new ApiError("link_invalid", "This link has expired or was already used");
    }
    return signInWith(link, now, request, reply);
  });

  const emailCodeLimits = [perAddress(rateLimits.emailCodePerAddress), rateLimitHook(rateLimits.emailCodePerEmail, codeEmailOf, clock)];

  app.post("/auth/email-code", { ...PUBLIC, preHandler: emailCodeLimits }, async (request, reply) => {
    const { email, code } = parseOrThrow(EmailCodeRequest, request.body, "The email code");
    const now = clock();
    const link = await consumeMagicLinkCode(sql, email, code, now);
    if (link === null) {
      throw new ApiError("link_invalid", "That code is wrong, has expired, or was already used");
    }
    return signInWith(link, now, request, reply);
  });

  app.post("/auth/link-code", { ...PUBLIC, preHandler: perAddress(rateLimits.linkCodePerAddress) }, async (request) => {
    const { code } = parseOrThrow(LinkCodeRequest, request.body, "The link code");
    const now = clock();
    const accountId = await consumeLinkCode(sql, code, now);
    if (accountId === null) {
      throw new ApiError("link_invalid", "That code is wrong, has expired, or was already used");
    }
    const session = await createSessionForAccount(sql, accountId, { now, sessionTtlDays });
    request.log.info(apiLogLines.auth.sessionCreated({ accountId, sessionId: session.id, surface: "extension" }));
    const [account] = await sql.query<{ email: string; first_name: string | null }>(
      "select email, first_name from accounts where id = $1",
      [accountId],
    );
    const linked: LinkedSession = {
      token: session.token,
      accountId,
      email: account!.email,
      firstName: account!.first_name,
      expiresAt: session.expiresAt,
    };
    return linked;
  });

  // The button in the old address's mail: public, because every session is about to end,
  // and the token is the whole proof (docs/features/account-changes.md, "Moving it back").
  app.post("/auth/email-change/revert", { ...PUBLIC, preHandler: perAddress(rateLimits.emailChangeRevertPerAddress) }, async (request) => {
    const { token } = parseOrThrow(SignInRequest, request.body, "The revert link");
    const result = await revertEmailChange(sql, token, clock());
    if (result.outcome === "refused") {
      request.log.warn(apiLogLines.auth.emailChangeRevertRefused({ reason: result.reason }));
      throw new ApiError("link_invalid", "This link can’t move the account back", {
        reason: result.reason,
        ...(result.reason === "taken" ? { email: result.email } : {}),
      });
    }
    request.log.info(apiLogLines.auth.emailChangeReverted({ accountId: result.accountId }));
    const reverted: EmailChangeReverted = { email: result.email };
    return reverted;
  });
}
