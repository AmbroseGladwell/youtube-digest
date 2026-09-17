import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import type { Overview, OverviewId } from "@overview/types";
import { Routes } from "../../app/Routes.js";
import { GenerateOverviewForm } from "../../features/newOverview/components/GenerateOverviewForm/GenerateOverviewForm.js";
import styles from "./AppShell.module.scss";
import { appShellTestIds } from "./AppShellTestIds.js";

// The generate form lives in the masthead, so the pages below it don't each own a copy.
// The id of whatever it just generated travels down through the outlet context, which is
// how the library knows which card to open (docs/features/overview-redesign.md).
export interface ShellOutletContext {
  justGeneratedId: OverviewId | null;
}

const GENERATE_SLOT_ID = "app-shell-generate";

export function AppShell() {
  const [justGeneratedId, setJustGeneratedId] = useState<OverviewId | null>(null);
  // On a phone the bar has no room for the paste field, so it sits behind "+ New" the way
  // the design's mobile header does. On desktop the field is always there and this flag
  // does nothing.
  const [newOverviewOpen, setNewOverviewOpen] = useState(false);

  const handleGenerated = (overview: Overview) => {
    setJustGeneratedId(overview.id);
    setNewOverviewOpen(false);
  };

  return (
    <div className={styles.root} data-testid={appShellTestIds.root}>
      <header className={styles.masthead} data-testid={appShellTestIds.masthead}>
        <Link className={styles.brand} to={Routes.home()}>
          <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" className={styles.mark}>
            <circle cx="16" cy="14.5" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
            <rect x="7" y="25" width="18" height="2.5" fill="currentColor" />
          </svg>
          <h1 className={styles.title}>The Overview</h1>
        </Link>

        <button
          type="button"
          className={styles.newOverviewButton}
          onClick={() => setNewOverviewOpen((open) => !open)}
          aria-expanded={newOverviewOpen}
          aria-controls={GENERATE_SLOT_ID}
          data-testid={appShellTestIds.newOverviewButton}
        >
          {newOverviewOpen ? "Close" : "+ New"}
        </button>

        <div
          id={GENERATE_SLOT_ID}
          className={`${styles.generateSlot} ${newOverviewOpen ? styles.generateSlotOpen : ""}`}
        >
          <GenerateOverviewForm onGenerated={handleGenerated} />
        </div>

        <nav className={styles.nav} aria-label="Sections">
          <NavLink
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            to={Routes.home()}
            end
          >
            Overviews
          </NavLink>
          <NavLink
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            to={Routes.settings()}
            data-testid={appShellTestIds.settingsLink}
          >
            Settings
          </NavLink>
        </nav>
      </header>
      <div className={styles.pane} data-testid={appShellTestIds.pane}>
        <Outlet context={{ justGeneratedId } satisfies ShellOutletContext} />
      </div>
    </div>
  );
}
