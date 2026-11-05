import { useEffect, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSyncConnection } from "../../../sync/useSyncConnection.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useUpdateAccountMutation } from "../../mutations/useUpdateAccountMutation.js";
import { EmailChangeFlow } from "../EmailChangeFlow/EmailChangeFlow.js";
import { NameEditor } from "../NameEditor/NameEditor.js";
import styles from "./AccountTile.module.scss";
import { accountTileTestIds } from "./AccountTileTestIds.js";

export interface AccountTileProps {
  email: string;
  firstName: string | null;
  // Said while a row is open, so the section's other primary can step down (design 14a).
  onEditingChange?: ((editing: boolean) => void) | undefined;
}

type Open = "name" | "email" | null;

// Designs 14a–14e: the "Signed in as" tile as two rows, Name and Email, each with its own
// Change. A row opens in place; nothing else on the section moves
// (docs/features/account-changes.md).
export function AccountTile({ email, firstName, onEditingChange }: AccountTileProps) {
  const analytics = useAnalytics();
  const { connection } = useSyncConnection();
  const updateAccount = useUpdateAccountMutation();
  const [open, setOpen] = useState<Open>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [emailChanged, setEmailChanged] = useState<{ from: string; to: string } | null>(null);
  const token = connection.token;

  useEffect(() => {
    onEditingChange?.(open !== null);
  }, [open, onEditingChange]);

  const openRow = (row: Open) => {
    setNameSaved(false);
    setEmailChanged(null);
    updateAccount.reset();
    setOpen(row);
  };

  return (
    <section className={styles.root} aria-label="Signed in as" data-testid={accountTileTestIds.root}>
      <p className={styles.heading}>Signed in as</p>

      {open === "name" ? (
        <NameEditor
          initialName={firstName}
          saving={updateAccount.isPending}
          refused={updateAccount.isError ? "Couldn’t save your name. Try again in a moment." : null}
          onSave={(name) =>
            updateAccount.mutate(
              { firstName: name },
              {
                onSuccess: () => {
                  analytics.settings.sync.nameSaved({ cleared: name === null });
                  setOpen(null);
                  setNameSaved(true);
                },
              },
            )
          }
          onCancel={() => setOpen(null)}
        />
      ) : (
        <div className={styles.row} data-testid={accountTileTestIds.nameRow}>
          <span className={styles.cell}>
            <span className={styles.label}>Name</span>
            <span className={styles.value} data-testid={accountTileTestIds.nameValue}>
              {firstName === null ? <span className={styles.unset}>Not set</span> : firstName}
            </span>
            {firstName === null && (
              <span className={styles.hint} data-testid={accountTileTestIds.nameHint}>
                Your email shows in its place.
              </span>
            )}
          </span>
          {open === null && (
            <button type="button" className={styles.change} onClick={() => openRow("name")} data-testid={accountTileTestIds.changeNameButton}>
              {firstName === null ? "Add name" : "Change"}
            </button>
          )}
          {open === "email" && firstName !== null && (
            <button type="button" className={styles.change} onClick={() => openRow("name")} data-testid={accountTileTestIds.changeNameButton}>
              Change
            </button>
          )}
        </div>
      )}
      {nameSaved && (
        <p className={styles.status} role="status" aria-live="polite" data-testid={accountTileTestIds.nameStatus}>
          <StrokeIcon name="check" size={15} />
          <span>
            <span className={styles.statusLead}>Saved.</span>{" "}
            <span className={styles.statusBody}>Your other devices show it the next time they check in.</span>
          </span>
        </p>
      )}

      <div className={styles.row} data-testid={accountTileTestIds.emailRow}>
        <span className={styles.cell}>
          <span className={styles.label}>Email</span>
          <span className={styles.value} data-testid={accountTileTestIds.emailValue}>
            {email}
          </span>
          {open !== "email" && (
            <span className={styles.hint} data-testid={accountTileTestIds.emailHint}>
              You sign in with this address.
            </span>
          )}
        </span>
        {open !== "email" && (
          <button type="button" className={styles.change} onClick={() => openRow("email")} data-testid={accountTileTestIds.changeEmailButton}>
            Change
          </button>
        )}
      </div>
      {open === "email" && (
        <EmailChangeFlow
          key={token ?? "cookie"}
          currentEmail={email}
          onDone={(newEmail) => {
            setOpen(null);
            setEmailChanged({ from: email, to: newEmail });
          }}
          onCancel={() => setOpen(null)}
        />
      )}
      {emailChanged !== null && (
        <p className={styles.status} role="status" aria-live="polite" data-testid={accountTileTestIds.emailStatus}>
          <StrokeIcon name="check" size={15} />
          <span>
            <span className={styles.statusLead}>Your email is now {emailChanged.to}.</span>{" "}
            <span className={styles.statusBody}>
              Use it to sign in from now on. We’ve told {emailChanged.from} about the change. You’re still signed in here
              and on your other devices.
            </span>
          </span>
        </p>
      )}
    </section>
  );
}
