import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useSync } from "../../../sync/SyncContext.js";
import { useSyncConnection } from "../../../sync/useSyncConnection.js";
import { syncStatusLine } from "../../../sync/util/syncStatusLine.js";
import { usePendingSignIn } from "../../usePendingSignIn.js";
import { useDeviceAccountHistory } from "../../../accountLibraries/useDeviceAccountHistory.js";
import { isConnected } from "../../../sync/types/SyncConnection.js";
import styles from "./AccountMenu.module.scss";
import { accountMenuTestIds } from "./AccountMenuTestIds.js";
import type { AccountMenuItem } from "@overview/domain";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useSignOut } from "../../../accountLibraries/useSignOut.js";

const ACCOUNT_PATHS = new Set([Routes.signIn(), Routes.createAccount(), Routes.connectExtension(), Routes.settings()]);

// Design 9j–9n and 10a: one person button in the bar in place of Settings and Sign in.
// What it holds follows what this device can do and who it is signed in as
// (docs/features/sign-in.md, "The account menu").
export function AccountMenu() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPanel = useIsPanel();
  const surface = useSurface();
  const sync = useSync();
  const signOut = useSignOut();
  const { connection } = useSyncConnection();
  const { pending } = usePendingSignIn();
  const { signedOutHere } = useDeviceAccountHistory();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);

  // The page a sign-out lands on may take focus itself (design 47b); only when it hasn't
  // does focus come back to the button.
  const refocusIfNothingElseIs = () =>
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) trigger.current?.focus();
    });

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const analytics = useAnalytics();
  const dismiss = (refocus: boolean) => {
    analytics.app.accountMenu.closed();
    close(refocus);
  };

  useDismissOnOutside(open, () => dismiss(true), root);

  const go = (path: string) => () => {
    close(false);
    void navigate(path);
  };

  const items = (): HTMLElement[] =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const move = (index: number) => {
      event.preventDefault();
      all[(index + all.length) % all.length]?.focus();
    };
    if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(all.length - 1);
    else if (event.key === "Tab") dismiss(false);
  };

  const openMenu = (focus: "first" | "last") => {
    analytics.app.accountMenu.opened();
    setOpen(true);
    requestAnimationFrame(() => {
      const all = items();
      (focus === "first" ? all[0] : all.at(-1))?.focus();
    });
  };

  const item = (icon: StrokeIconName, label: string, name: AccountMenuItem, onSelect: () => void, testId: string) => (
    <button
      type="button"
      role="menuitem"
      className={styles.item}
      onClick={() => {
        analytics.app.accountMenu.itemChosen({ item: name });
        onSelect();
      }}
      data-testid={testId}
    >
      <StrokeIcon name={icon} size={16} />
      {label}
    </button>
  );

  const signedOutAtServer = sync.status.phase === "signedOut";
  const settings = item("settings", "Settings", "settings", go(Routes.settings()), accountMenuTestIds.settingsItem);

  let content: ReactNode;
  if (!sync.available) {
    content = (
      <>
        {settings}
        <p className={styles.aside} data-testid={accountMenuTestIds.noAccountsNote}>
          Accounts need the web app or the extension.
        </p>
      </>
    );
  } else if (sync.connected) {
    content = (
      <>
        <div className={styles.who} data-testid={accountMenuTestIds.who}>
          {connection.firstName !== null && (
            <span className={styles.name} data-testid={accountMenuTestIds.name}>
              {connection.firstName}
            </span>
          )}
          {connection.email !== null && (
            <span className={connection.firstName === null ? styles.emailAlone : styles.email}>{connection.email}</span>
          )}
          {surface === "extension" && (
            <span className={styles.status} data-testid={accountMenuTestIds.syncStatus}>
              <StrokeIcon name="refresh" size={13} />
              {syncStatusLine(sync.status, new Date())}
            </span>
          )}
        </div>
        <div role="separator" className={styles.separator} />
        {surface === "web" &&
          !signedOutAtServer &&
          item("puzzle", "Connect the extension", "connectExtension", go(Routes.connectExtension()), accountMenuTestIds.connectExtensionItem)}
        {settings}
        {signedOutAtServer
          ? item(
              "signIn",
              "Sign in again",
              "signInAgain",
              () => {
                close(false);
                void signOut().then(() => navigate(Routes.signIn()));
              },
              accountMenuTestIds.signInAgainItem,
            )
          : sync.signingOut
            ? (
                <div
                  role="menuitem"
                  aria-disabled="true"
                  aria-live="polite"
                  tabIndex={-1}
                  autoFocus
                  className={styles.signingOut}
                  data-testid={accountMenuTestIds.signingOut}
                >
                  <span className={styles.spinner}>
                    <StrokeIcon name="loader" size={16} />
                  </span>
                  Syncing before you sign out…
                </div>
              )
            : item(
                "signOut",
                "Sign out",
                "signOut",
                () => void signOut().then(() => close(false)).then(refocusIfNothingElseIs),
                accountMenuTestIds.signOutItem,
              )}
      </>
    );
  } else if (surface === "extension" && pending !== null) {
    content = (
      <>
        <div className={styles.who} data-testid={accountMenuTestIds.waiting}>
          <span className={styles.waitingTitle}>Waiting for your code</span>
          <span className={styles.email}>{pending.email}</span>
        </div>
        {item("puzzle", "Enter code", "enterCode", go(Routes.signIn()), accountMenuTestIds.enterCodeItem)}
        <div role="separator" className={styles.separator} />
        {settings}
      </>
    );
  } else {
    content = (
      <>
        {item("signIn", "Sign in", "signIn", go(Routes.signIn()), accountMenuTestIds.signInItem)}
        {item("userPlus", "Create account", "createAccount", go(Routes.createAccount()), accountMenuTestIds.createAccountItem)}
        <div role="separator" className={styles.separator} />
        {settings}
      </>
    );
  }

  const current = open || ACCOUNT_PATHS.has(pathname) || pathname.startsWith(`${Routes.settings()}/`);

  return (
    <div className={styles.root} ref={root} data-testid={accountMenuTestIds.root}>
      <button
        type="button"
        ref={trigger}
        className={`${styles.trigger} ${current ? styles.triggerCurrent : ""} ${isPanel ? "" : styles.triggerBar}`}
        onClick={() => (open ? dismiss(false) : openMenu("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openMenu("first");
          } else if (event.key === "ArrowUp" && !open) {
            event.preventDefault();
            openMenu("last");
          }
        }}
        aria-label={signedOutHere && sync.available && !isConnected(connection) ? "Account, signed out" : "Account"}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={accountMenuTestIds.trigger}
      >
        <StrokeIcon name="user" size={18} />
      </button>

      {open && (
        <div
          className={styles.menu}
          role="menu"
          aria-label="Account"
          ref={menu}
          onKeyDown={onMenuKeyDown}
          data-testid={accountMenuTestIds.menu}
        >
          {content}
        </div>
      )}
    </div>
  );
}
