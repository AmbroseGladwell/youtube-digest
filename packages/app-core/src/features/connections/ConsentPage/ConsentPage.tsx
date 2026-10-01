import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { consentPath, MAGIC_LINK_TTL_MINUTES } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { RouteParams } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useNow } from "../../../util/useNow.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { ResendLinkButton } from "../../auth/components/ResendLinkButton/ResendLinkButton.js";
import { useRequestMagicLinkMutation } from "../../auth/mutations/useRequestMagicLinkMutation.js";
import { useSessionQuery } from "../../auth/queries/sessionQuery.js";
import { authFailureMessage, LINK_SPENT } from "../../auth/util/authFailureMessage.js";
import { useSync } from "../../sync/SyncContext.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { ConsentAddressCard } from "../components/ConsentAddressCard/ConsentAddressCard.js";
import { ConsentAnswer, type ConsentDecision } from "../components/ConsentAnswer/ConsentAnswer.js";
import { ConsentNote } from "../components/ConsentNote/ConsentNote.js";
import { ConsentPlusCard } from "../components/ConsentPlusCard/ConsentPlusCard.js";
import { ConsentSignInCard } from "../components/ConsentSignInCard/ConsentSignInCard.js";
import { rememberConsentLinkAsked, wasConsentLinkAskedHere } from "../consentLinksAskedStorage.js";
import { useDecideConnectionMutation } from "../mutations/useDecideConnectionMutation.js";
import { useConnectionRequestQuery } from "../queries/connectionRequestQuery.js";
import { consentHeading } from "../util/consentHeading.js";
import { minutesLeft, minutesLeftPhrase } from "../util/minutesLeft.js";
import styles from "./ConsentPage.module.scss";
import { consentPageTestIds } from "./ConsentPageTestIds.js";

export interface ConsentPageLocationState {
  fromSignInLink?: boolean;
}

const EXPIRED_BODY =
  "Requests from an assistant last 30 minutes and can be answered once. Start again from your assistant and it will send you back here.";

const isCode = (error: unknown, code: string) => isSyncRequestError(error) && error.code === code;

function useOnce(when: boolean, record: () => void): void {
  const recorded = useRef(false);
  useEffect(() => {
    if (!when || recorded.current) return;
    recorded.current = true;
    record();
  }, [when, record]);
}

// Where an assistant sends a reader to answer its request (design 58,
// docs/features/mcp-connector.md, "The consent screen").
export function ConsentPage() {
  const requestId = useParams()[RouteParams.requestId] ?? "";
  const location = useLocation();
  const surface = useSurface();
  const sync = useSync();
  const { connection } = useSyncConnection();
  const knownApiUrl = useKnownApiUrl();
  const isPhone = useIsPhone();
  const now = useNow(15_000);
  const request = useConnectionRequestQuery(requestId);
  const session = useSessionQuery();
  const decide = useDecideConnectionMutation();
  const requestLink = useRequestMagicLinkMutation();
  const analytics = useAnalytics();
  const [deciding, setDeciding] = useState<ConsentDecision | null>(null);
  const [sent, setSent] = useState<{ email: string; sentAt: number } | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const [otherDevice] = useState(
    () =>
      (location.state as ConsentPageLocationState | null)?.fromSignInLink === true &&
      !wasConsentLinkAskedHere(requestId),
  );
  const heading = useRef<HTMLHeadingElement | null>(null);
  const loaded = request.data !== undefined;
  const signedIn = sync.connected && !isCode(session.error, "unauthenticated");
  const plan = signedIn ? session.data?.plan : undefined;

  useEffect(() => {
    if (loaded) heading.current?.focus();
  }, [loaded, sent]);
  useOnce(loaded, analytics.mcp.consentScreen.shown);
  useOnce(loaded && plan === "free", analytics.mcp.consentScreen.plusRequired);

  if (!sync.available) {
    return <ErrorState title="Accounts need the web app or the extension" back />;
  }

  if (request.isError || isCode(decide.error, "not_found")) {
    return isCode(request.error ?? decide.error, "not_found") ? (
      <ErrorState title="This request has expired" body={EXPIRED_BODY} back />
    ) : (
      <ErrorState
        title="We couldn't load this request"
        error={request.error ?? decide.error}
        body="The server didn't answer. Check your connection and try again."
        action={{ label: "Try again", onSelect: () => void request.refetch() }}
      />
    );
  }

  if (request.data === undefined) {
    return <div className={styles.root} aria-busy="true" data-testid={consentPageTestIds.loading} />;
  }

  const { redirectHost: host, clientName, expiresAt } = request.data;
  const left = minutesLeft(expiresAt, now);
  const { title, label, sub } = consentHeading(clientName);

  const answer = (decision: ConsentDecision) => {
    if (plan === undefined) return;
    setDeciding(decision);
    decide.mutate(
      { requestId, approve: decision === "approve", plan },
      {
        onError: (error) => {
          setDeciding(null);
          if (isCode(error, "plan_required") || isCode(error, "unauthenticated")) void session.refetch();
        },
      },
    );
  };

  const askForLink = (email: string) => {
    if (knownApiUrl === null) return;
    setRefused(null);
    requestLink.mutate(
      {
        apiUrl: knownApiUrl,
        request: { email, surface, intent: "signIn", returnTo: consentPath(requestId) },
      },
      {
        onSuccess: () => {
          rememberConsentLinkAsked(requestId, Date.now());
          setSent({ email, sentAt: Date.now() });
        },
        onError: (error) => setRefused(authFailureMessage(error, LINK_SPENT)),
      },
    );
  };

  const headingElement = (
    <h1
      className={styles.heading}
      ref={heading}
      tabIndex={-1}
      aria-label={label === title ? undefined : label}
      data-testid={consentPageTestIds.heading}
    >
      {title}
    </h1>
  );

  if (!signedIn && sent !== null) {
    const device = isPhone ? "phone" : "computer";
    const otherKind = isPhone ? "a computer" : "your phone";
    const deviceNote = (
      <ConsentNote
        icon={isPhone ? "smartphone" : "monitor"}
        title={`Open the link on this ${device}`}
        body={`The request is waiting in this browser. Opened on ${otherKind}, the link would sign that in instead, and send it back to ${host}.`}
      />
    );
    return (
      <div className={styles.root} data-testid={consentPageTestIds.checkEmail}>
        <div className={styles.question}>
          <span className={styles.mailBadge}>
            <StrokeIcon name="mail" size={22} />
          </span>
          <h1 className={`${styles.heading} ${styles.checkEmailHeading}`} ref={heading} tabIndex={-1}>
            Check your email
          </h1>
          <p className={styles.lead}>
            We sent a sign-in link to{" "}
            <strong data-testid={consentPageTestIds.checkEmailAddress}>{sent.email}</strong>. It works once, for the
            next {MAGIC_LINK_TTL_MINUTES} minutes.
          </p>
          {isPhone && deviceNote}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setLastEmail(sent.email);
                requestLink.reset();
                setSent(null);
              }}
              data-testid={consentPageTestIds.differentEmailButton}
            >
              Use a different email
            </button>
            <ResendLinkButton
              sentAt={sent.sentAt}
              sending={requestLink.isPending}
              label="Send another"
              onResend={() => askForLink(sent.email)}
            />
          </div>
        </div>
        <div className={styles.answer}>
          <div className={styles.waiting} data-testid={consentPageTestIds.waiting}>
            <p className={styles.kicker}>Waiting for your answer</p>
            <p className={styles.waitingTitle} aria-label={label === title ? undefined : label}>
              {title}
            </p>
            <p className={styles.waitingMeta}>
              <span className={styles.waitingHost}>
                <StrokeIcon name="link" size={14} />
                Back to {host}
              </span>
              <span aria-hidden="true">·</span>
              <span data-testid={consentPageTestIds.waitingOpenFor}>Open for {minutesLeftPhrase(left)}</span>
            </p>
          </div>
          {!isPhone && deviceNote}
        </div>
      </div>
    );
  }

  const signedInAs = signedIn && connection.email !== null && (
    <p className={styles.signedInAs} data-testid={consentPageTestIds.signedInAs}>
      Signed in as <span className={styles.email}>{connection.email}</span>.{" "}
      <button
        type="button"
        className={styles.notYou}
        onClick={() => void sync.signOut()}
        disabled={deciding !== null}
        data-testid={consentPageTestIds.notYouButton}
      >
        Not you?
      </button>
    </p>
  );

  const otherDeviceNote = otherDevice && (
    <ConsentNote
      icon={isPhone ? "monitor" : "smartphone"}
      title={isPhone ? "Started on a computer?" : "Started on another device?"}
      body={
        isPhone
          ? `Approving here sends this phone back to ${host}, not the computer. To finish there, open the email on the computer.`
          : `Approving here sends this browser back to ${host}, not the other device. To finish there, open the email on that device.`
      }
    />
  );

  return (
    <div className={styles.root} data-testid={consentPageTestIds.root}>
      <div className={styles.question}>
        {otherDeviceNote}
        <p className={styles.kicker} data-testid={consentPageTestIds.kicker}>
          Connect an assistant
        </p>
        {headingElement}
        <p className={styles.sub} data-testid={consentPageTestIds.sub}>
          {sub}
        </p>
        {!isPhone && signedInAs}
      </div>
      <div className={styles.answer}>
        <ConsentAddressCard host={host} />
        {!signedIn ? (
          <ConsentSignInCard
            initialEmail={lastEmail}
            sending={requestLink.isPending}
            refused={refused}
            onSubmit={askForLink}
          />
        ) : session.isError ? (
          <p className={styles.error} role="alert" data-testid={consentPageTestIds.sessionError}>
            <StrokeIcon name="alertCircle" size={14} />
            We couldn't check your account.{" "}
            <button type="button" className={styles.retry} onClick={() => void session.refetch()}>
              Try again
            </button>
          </p>
        ) : plan === undefined ? (
          <div className={styles.planPending} aria-busy="true" />
        ) : plan === "plus" ? (
          <ConsentAnswer host={host} deciding={deciding} onDecide={answer} />
        ) : (
          <ConsentPlusCard minutesLeft={left} declining={deciding === "decline"} onDecline={() => answer("decline")} />
        )}
        {decide.isError && !isCode(decide.error, "plan_required") && !isCode(decide.error, "unauthenticated") && (
          <p className={styles.error} role="alert" data-testid={consentPageTestIds.decisionError}>
            <StrokeIcon name="alertCircle" size={14} />
            That answer didn't reach the server. Try again.
          </p>
        )}
        {isPhone && signedInAs}
      </div>
    </div>
  );
}
