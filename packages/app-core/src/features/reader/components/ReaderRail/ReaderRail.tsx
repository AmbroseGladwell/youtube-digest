import styles from "./ReaderRail.module.scss";
import { readerRailTestIds } from "./ReaderRailTestIds.js";

export interface ReaderRailProps {
  sections: string[];
  currentSection: string;
  onSelectSection: (section: string) => void;
  videoUrl: string;
  sourceNote: string | null;
  jump: { label: string; href: string } | null;
}

export function ReaderRail({
  sections,
  currentSection,
  onSelectSection,
  videoUrl,
  sourceNote,
  jump,
}: ReaderRailProps) {
  return (
    <aside className={styles.root} data-testid={readerRailTestIds.root}>
      <div className={styles.sticky} data-testid={readerRailTestIds.sticky}>
        {sections.length > 0 && (
          <nav aria-label="Sections" data-testid={readerRailTestIds.sections}>
            <p className={styles.label}>Sections</p>
            {sections.map((section) => (
              <button
                key={section}
                type="button"
                className={`${styles.section} ${section === currentSection ? styles.sectionCurrent : ""}`}
                aria-current={section === currentSection}
                onClick={() => onSelectSection(section)}
                data-testid={readerRailTestIds.section(section)}
              >
                {section}
              </button>
            ))}
          </nav>
        )}

        <div>
          <p className={styles.label}>Source</p>
          <a
            className={styles.watchLink}
            href={videoUrl}
            target="_blank"
            rel="noopener"
            data-testid={readerRailTestIds.watchLink}
          >
            Watch on YouTube
          </a>
          {sourceNote && (
            <p className={styles.sourceNote} data-testid={readerRailTestIds.sourceNote}>
              {sourceNote}
            </p>
          )}
          {jump && (
            <a
              className={styles.jumpLink}
              href={jump.href}
              target="_blank"
              rel="noopener"
              data-testid={readerRailTestIds.jumpLink}
            >
              {jump.label}
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
