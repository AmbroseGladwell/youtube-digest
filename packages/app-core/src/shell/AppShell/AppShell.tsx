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

export function AppShell() {
  const [justGeneratedId, setJustGeneratedId] = useState<OverviewId | null>(null);

  const handleGenerated = (overview: Overview) => setJustGeneratedId(overview.id);

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

        <div className={styles.generateSlot}>
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
