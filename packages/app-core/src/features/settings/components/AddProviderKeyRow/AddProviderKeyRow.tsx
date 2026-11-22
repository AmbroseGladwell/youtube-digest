import { useEffect, useRef, useState, type FormEvent } from "react";
import { PROVIDER_CONSOLE, PROVIDER_LABEL, PROVIDER_SHORT_LABEL, type Provider } from "@overview/domain";
import { useAddProviderKey, type AddKeyState } from "../../../apiKeys/useAddProviderKey.js";
import styles from "./AddProviderKeyRow.module.scss";
import { addProviderKeyRowTestIds } from "./AddProviderKeyRowTestIds.js";

export interface AddProviderKeyRowProps {
  provider: Provider;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSaved: () => void;
  // Named so the refusal can end by saying what still works.
  inUseProvider: Provider | null;
}

// Nothing turns red; the words say what did not change.
const problemText = (state: AddKeyState, provider: Provider, inUseProvider: Provider | null): string | null => {
  const console = PROVIDER_CONSOLE[provider];
  switch (state.step) {
    case "refused":
      return (
        `It may have been revoked, or copied without its last few characters. Paste it again, or make a new ` +
        `one at ${console.host}.` +
        (inUseProvider === null ? "" : ` Nothing else has changed: you still generate with ${PROVIDER_SHORT_LABEL[inUseProvider]}.`)
      );
    case "permission-denied":
      return `The extension asks for each provider only when you add its key. Save key asks Chrome again.`;
    case "failed":
      return state.message;
    default:
      return null;
  }
};

const headingText = (state: AddKeyState, provider: Provider): string | null => {
  const name = PROVIDER_SHORT_LABEL[provider];
  switch (state.step) {
    case "refused":
      return `${name} didn’t accept this key.`;
    case "permission-denied":
      return `Chrome didn’t allow the extension to reach ${name}, so the key isn’t saved.`;
    case "failed":
      return `${name} couldn’t be reached.`;
    default:
      return null;
  }
};

const statusText = (state: AddKeyState, provider: Provider): string | null => {
  switch (state.step) {
    case "permission":
      return "Waiting for Chrome’s permission…";
    case "checking":
      return `Checking the key with ${PROVIDER_SHORT_LABEL[provider]} and fetching its models…`;
    default:
      return null;
  }
};

export const AddProviderKeyRow = ({ provider, open, onOpen, onClose, onSaved, inUseProvider }: AddProviderKeyRowProps) => {
  const [key, setKey] = useState("");
  const { state, add, reset } = useAddProviderKey(provider);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      input.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (state.step === "saved") {
      setKey("");
      onSaved();
    }
  }, [state.step, onSaved]);

  if (!open) {
    return (
      <li className={styles.quiet} data-testid={addProviderKeyRowTestIds.root(provider)}>
        <span className={styles.name}>{PROVIDER_LABEL[provider]}</span>
        <button type="button" className={styles.open} onClick={onOpen} data-testid={addProviderKeyRowTestIds.open(provider)}>
          Add key
        </button>
      </li>
    );
  }

  const busy = state.step === "checking" || state.step === "permission";
  const heading = headingText(state, provider);
  const problem = problemText(state, provider, inUseProvider);
  const status = statusText(state, provider);
  const console = PROVIDER_CONSOLE[provider];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = key.trim();
    if (trimmed !== "") {
      void add(trimmed);
    }
  };

  return (
    <li className={styles.openRow} data-testid={addProviderKeyRowTestIds.root(provider)}>
      <form className={styles.form} onSubmit={submit}>
        <span className={styles.name}>{PROVIDER_LABEL[provider]}</span>
        <label className={styles.label} htmlFor={`${provider}-api-key`}>
          Your {PROVIDER_SHORT_LABEL[provider]} key
        </label>
        <input
          id={`${provider}-api-key`}
          ref={input}
          name={`${provider}-api-key`}
          className={styles.input}
          type="password"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            if (state.step !== "idle") {
              reset();
            }
          }}
          data-testid={addProviderKeyRowTestIds.input(provider)}
        />

        {status !== null && (
          <p className={styles.status} role="status" data-testid={addProviderKeyRowTestIds.status(provider)}>
            {status}
          </p>
        )}

        {heading !== null && (
          <div className={styles.problem} data-testid={addProviderKeyRowTestIds.problem(provider)}>
            <p className={styles.problemHeading}>{heading}</p>
            {problem !== null && <p className={styles.hint}>{problem}</p>}
          </div>
        )}

        {status === null && heading === null && (
          <p className={styles.hint}>
            Don’t have one? Make one at{" "}
            <a
              className={styles.link}
              href={console.url}
              target="_blank"
              rel="noreferrer"
              data-testid={addProviderKeyRowTestIds.console(provider)}
            >
              {console.host}
            </a>
            , then paste it here.
          </p>
        )}

        {!busy && (
          <div className={styles.actions}>
            <button type="submit" className={styles.save} data-testid={addProviderKeyRowTestIds.save(provider)}>
              Save key
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => {
                setKey("");
                reset();
                onClose();
              }}
              data-testid={addProviderKeyRowTestIds.cancel(provider)}
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </li>
  );
};
