import { useEffect, useRef, type ReactNode } from "react";
import { Routes } from "../../../app/Routes.js";
import { legalIdentity } from "../legalIdentity.js";
import styles from "./LegalPage.module.scss";
import { legalPageTestIds } from "./LegalPageTestIds.js";
import { PageLink } from "../../../components/shared/PageLink/PageLink.js";

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

export interface LegalPageProps {
  title: string;
  updatedOn: string;
  intro: ReactNode;
  sections: readonly LegalSection[];
  otherPage: { label: string; to: string };
}

const updatedLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// One long-form layout for the privacy policy and the terms: a heading that takes focus on
// arrival, the date the text last changed, a contents list of the sections, and the sections
// themselves, each an h2 (docs/features/legal-pages.md).
export function LegalPage({ title, updatedOn, intro, sections, otherPage }: LegalPageProps) {
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [title]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${legalIdentity.service}`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <article className={styles.root} data-testid={legalPageTestIds.root}>
      <header className={styles.head}>
        <h1 className={styles.title} ref={heading} tabIndex={-1} data-testid={legalPageTestIds.title}>
          {title}
        </h1>
        <p className={styles.updated} data-testid={legalPageTestIds.updated}>
          Last updated <time dateTime={updatedOn}>{updatedLabel.format(new Date(updatedOn))}</time>
        </p>
        <div className={styles.intro}>{intro}</div>
      </header>
      <nav className={styles.contents} aria-label="Contents" data-testid={legalPageTestIds.contents}>
        <ol className={styles.contentsList}>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.heading}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className={styles.section}
          aria-labelledby={`${section.id}-heading`}
          data-testid={legalPageTestIds.section}
        >
          <h2 id={`${section.id}-heading`} className={styles.sectionHeading}>
            {section.heading}
          </h2>
          <div className={styles.body}>{section.body}</div>
        </section>
      ))}
      <footer className={styles.foot}>
        <PageLink to={otherPage.to} data-testid={legalPageTestIds.otherPage}>
          {otherPage.label}
        </PageLink>
        <PageLink to={Routes.home()}>Back to {legalIdentity.service}</PageLink>
      </footer>
    </article>
  );
}
