import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  AccountUpdate,
  apiLogLines,
  CodeRequest,
  EmailChangeRequest,
  revertEmailLink,
  type EmailChangeAsked,
  type LinkCode,
  type SessionInfo,
  type VerificationAsked,
  VerificationRequest,
} from "@overview/domain";
import type { AudioStore } from "../audio/AudioStore.js";
import type { PersonEraser } from "../postHog/PersonEraser.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { Mailer } from "../mail/Mailer.js";
import type { RateLimit } from "../rateLimit/RateLimit.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { accountPlan } from "./accountPlan.js";
import { deleteSession } from "./deleteSession.js";
import { eraseAccount, finishAccountDeletion } from "./deleteAccount.js";
import { confirmEmailChange, issueEmailChange } from "./emailChange.js";
import { issueLinkCode } from "./issueLinkCode.js";
import { normaliseEmail } from "./normaliseEmail.js";
import type { Session } from "./Session.js";
import { clearedSessionCookie } from "./sessionCookie.js";
import { confirmSessionVerification, isSessionVerified, issueSessionVerification } from "./sessionVerification.js";

export interface SessionRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  mailer: Mailer;
  appUrl: string;
  supportEmail: string;
  sessionCookieSecure: boolean;
  // Where a deleted account's narration files and analytics records are erased from;
  // null when narration or PostHog erasure is not configured (docs/features/account-deletion.md).
  narrationStore: AudioStore | null;
  personEraser: PersonEraser | null;
}

const CODE_REFUSED = "That code is wrong, has expired, or was already used";

// The session's own routes: who it is, a code for the extension, signing out, and the
// account's changes. A name needs only the session; a new email needs the session to have
// proved its inbox first, then the new inbox to prove itself (docs/features/account-changes.md).
// Deleting the account needs the same proof (docs/features/account-deletion.md).
export function sessionRoutes(
  app: FastifyInstance,
  { sql, clock, mailer, appUrl, supportEmail, sessionCookieSecure, narrationStore, personEraser }: SessionRoutesOptions,
): void {
  const perAccount = (rateLimit: RateLimit) =>
    rateLimitHook(rateLimit, (request: FastifyRequest) => request.session?.accountId ?? null, clock);

  const sessionInfo = async (session: Session, email: string, firstName: string | null): Promise<SessionInfo> => ({
    accountId: session.accountId,
    email,
    firstName,
    expiresAt: session.expiresAt,
    plan: await accountPlan(sql, session.accountId),
  });

  app.get("/session", async (request) => {
    const session = request.session!;
    return sessionInfo(session, session.email, session.firstName);
  });

  app.post("/session/link-code", async (request) => {
    const issued = await issueLinkCode(sql, request.session!.accountId, clock());
    request.log.info(apiLogLines.auth.linkCodeIssued({ transport: request.session!.transport }));
    const linkCode: LinkCode = { linkCode: issued.code, linkCodeExpiresAt: issued.expiresAt };
    return linkCode;
  });

  app.delete("/session", async (request, reply) => {
    const session = request.session!;
    await deleteSession(sql, session.tokenHash);
    request.log.info(apiLogLines.auth.signedOut({ transport: session.transport }));
    if (session.transport === "cookie") {
      reply.header("set-cookie", clearedSessionCookie({ secure: sessionCookieSecure }));
    }
    return reply.status(204).send();
  });

  app.put("/session/account", async (request) => {
    const { firstName } = parseOrThrow(AccountUpdate, request.body, "The account");
    const session = request.session!;
    await sql.query("update accounts set first_name = $2 where id = $1", [session.accountId, firstName]);
    request.log.info(apiLogLines.auth.nameChanged({ cleared: firstName === null }));
    return sessionInfo(session, session.email, firstName);
  });

  app.delete("/session/account", async (request, reply) => {
    const session = request.session!;
    const now = clock();
    if (!(await isSessionVerified(sql, session, now))) {
      throw new ApiError("verification_required", "Confirm it’s you before deleting your account");
    }
    const erased = await eraseAccount(sql, { accountId: session.accountId, email: session.email, now, narrationStore, personEraser });
    const finished = await finishAccountDeletion(sql, erased, { narrationStore, personEraser, log: request.log, now: clock });
    request.log.info(
      apiLogLines.auth.accountDeleted({
        deletionId: finished.id,
        narrationFiles: finished.narrationKeys.length,
        narration: finished.narration,
        postHogAccount: finished.postHogAccount,
        postHogAnonymous: finished.postHogAnonymous,
      }),
    );
    if (session.transport === "cookie") {
      reply.header("set-cookie", clearedSessionCookie({ secure: sessionCookieSecure }));
    }
    return reply.status(204).send();
  });

  app.post("/session/verification", { preHandler: perAccount(rateLimits.verificationPerAccount) }, async (request) => {
    const { purpose } = parseOrThrow(VerificationRequest, request.body ?? {}, "The verification");
    const session = request.session!;
    const now = clock();
    if (await isSessionVerified(sql, session, now)) {
      request.log.info(apiLogLines.auth.verificationAsked({ fresh: true, purpose }));
      const asked: VerificationAsked = { required: false };
      return asked;
    }
    const issued = await issueSessionVerification(sql, session.id, now);
    let expiresAt: string;
    if (issued === null) {
      request.log.warn(apiLogLines.auth.verificationHeldBack({ reason: "cooldown" }));
      expiresAt = await latestExpiry(sql, "session_verifications", "session_id", session.id);
    } else {
      await mailer.sendAccountMail({ kind: "verificationCode", to: session.email, code: issued.code, expiresAt: issued.expiresAt, supportEmail, purpose });
      request.log.info(apiLogLines.auth.verificationAsked({ fresh: false, purpose }));
      expiresAt = issued.expiresAt;
    }
    const asked: VerificationAsked = { required: true, email: session.email, expiresAt };
    return asked;
  });

  app.post("/session/verification/confirm", async (request, reply) => {
    const { code } = parseOrThrow(CodeRequest, request.body, "The code");
    const confirmed = await confirmSessionVerification(sql, request.session!.id, code, clock());
    if (!confirmed) {
      throw new ApiError("link_invalid", CODE_REFUSED);
    }
    request.log.info(apiLogLines.auth.verificationConfirmed());
    return reply.status(204).send();
  });

  app.post("/session/email-change", { preHandler: perAccount(rateLimits.emailChangePerAccount) }, async (request, reply) => {
    const { email } = parseOrThrow(EmailChangeRequest, request.body, "The new email");
    const session = request.session!;
    const now = clock();
    if (!(await isSessionVerified(sql, session, now))) {
      throw new ApiError("verification_required", "Confirm it’s you before changing your email");
    }
    const newEmail = normaliseEmail(email);
    if (newEmail === session.email) {
      throw new ApiError("invalid_request", "That’s already your email");
    }
    const issued = await issueEmailChange(sql, { accountId: session.accountId, oldEmail: session.email, newEmail, now });
    let expiresAt: string;
    if (issued === null) {
      request.log.warn(apiLogLines.auth.emailChangeHeldBack({ reason: "cooldown" }));
      expiresAt = await latestExpiry(sql, "email_changes", "account_id", session.accountId);
    } else {
      await mailer.sendAccountMail(
        issued.code === null
          ? { kind: "emailTaken", to: issued.newEmail }
          : { kind: "emailChangeCode", to: issued.newEmail, code: issued.code, expiresAt: issued.expiresAt },
      );
      request.log.info(apiLogLines.auth.emailChangeAsked());
      expiresAt = issued.expiresAt;
    }
    const asked: EmailChangeAsked = { accepted: true, expiresAt };
    return reply.status(202).send(asked);
  });

  app.post("/session/email-change/confirm", async (request) => {
    const { code } = parseOrThrow(CodeRequest, request.body, "The code");
    const session = request.session!;
    const now = clock();
    const result = await confirmEmailChange(sql, session.accountId, code, now);
    switch (result.outcome) {
      case "invalid":
        throw new ApiError("link_invalid", CODE_REFUSED);
      case "taken":
        throw new ApiError("already_exists", "That address belongs to another account now, so it can’t move to yours");
      case "changed": {
        await mailer.sendAccountMail({
          kind: "emailChanged",
          to: result.oldEmail,
          newEmail: result.newEmail,
          changedAt: now.toISOString(),
          revertLink: revertEmailLink(appUrl, result.revertToken),
          supportEmail,
        });
        request.log.info(apiLogLines.auth.emailChangeConfirmed());
        return sessionInfo(session, result.newEmail, session.firstName);
      }
    }
  });
}

async function latestExpiry(sql: SqlClient, table: "session_verifications" | "email_changes", column: "session_id" | "account_id", id: string): Promise<string> {
  const rows = await sql.query<{ expires_at: string | Date }>(
    `select expires_at from ${table} where ${column} = $1 order by created_at desc limit 1`,
    [id],
  );
  return new Date(rows[0]!.expires_at).toISOString();
}
