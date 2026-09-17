import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import type { Overview } from "@overview/types";
import { Routes } from "../../app/Routes.js";
import { GenerateOverviewForm } from "../../features/newOverview/components/GenerateOverviewForm/GenerateOverviewForm.js";
import styles from "./AppShell.module.scss";
import { appShellTestIds } from "./AppShellTestIds.js";
import { useMastheadHeight } from "./useMastheadHeight.js";

// The generate form lives in the masthead, so the pages below it don't each own a copy.
// What it generates opens straight in the reader, which is where the design sends you
// after a capture (docs/features/overview-redesign.md).
const GENERATE_SLOT_ID = "app-shell-generate";

export function AppShell() {
  const navigate = useNavigate();
  const mastheadHeight = useMastheadHeight();
  // The paste field stays behind "+ New" at every width, not just on a phone: a bar
  // carrying the field and its button at all times is more furniture than the one control
  // is worth (docs/features/overview-redesign.md).
  const [newOverviewOpen, setNewOverviewOpen] = useState(false);

  const handleGenerated = (overview: Overview) => {
    setNewOverviewOpen(false);
    void navigate(Routes.overview(overview.id));
  };

  return (
    <div className={styles.root} ref={mastheadHeight.root} data-testid={appShellTestIds.root}>
      <header
        className={styles.masthead}
        ref={mastheadHeight.masthead}
        data-testid={appShellTestIds.masthead}
      >
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
          <div className={styles.generateInner}>
            <GenerateOverviewForm onGenerated={handleGenerated} />
          </div>
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
        <Outlet />
      </div>
    </div>
  );
}
