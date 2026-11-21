import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { codeFromHash } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { AuthScreen } from "../components/AuthScreen/AuthScreen.js";
import styles from "./CopyCodePage.module.scss";
import { copyCodePageTestIds } from "./CopyCodePageTestIds.js";

// Where a code-first mail's Copy code lands (327l-3): a mail client runs no script, so this page
// copies the code, shows it large and selectable, and offers the sign-in page. The code comes in
// the fragment, so it never reaches a log.
export function CopyCodePage() {
  const code = codeFromHash(useLocation().hash);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (code === null) return;
    void navigator.clipboard
      ?.writeText(code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };
  useEffect(copy, [code]);

  if (code === null) {
    return <AuthScreen testId={copyCodePageTestIds.root} title="There’s no code here" lead="Open the Copy code link in the email again." />;
  }
  return (
    <AuthScreen
      testId={copyCodePageTestIds.root}
      title={copied ? "Code copied" : "Your code"}
      lead="Paste it on the page that asked for it. It works once, for fifteen minutes after we sent it."
    >
      <p className={styles.code} data-testid={copyCodePageTestIds.code}>
        {code}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.copy} onClick={copy} data-testid={copyCodePageTestIds.copy}>
          <StrokeIcon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Copied" : "Copy code"}
        </button>
        <PageLink className={styles.quiet} to={Routes.signIn()} data-testid={copyCodePageTestIds.signIn}>
          Open the sign-in page
        </PageLink>
      </div>
    </AuthScreen>
  );
}
