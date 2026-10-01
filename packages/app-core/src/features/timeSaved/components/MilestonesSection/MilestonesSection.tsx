import { useEffect, useState, type CSSProperties } from "react";
import { MILESTONES, spokenTimeSaved, timeSavedSummary, type MilestoneId } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../../../overviews/types/LibraryEntry.js";
import { milestonesColouredHere, rememberMilestonesColoured } from "../../milestonesColouredStorage.js";
import { useMilestones } from "../../useMilestones.js";
import { milestoneColourStyle } from "../../util/milestoneColourStyle.js";
import {
  formatReachedOn,
  milestoneTiles,
  reachedCount,
  spokenTimeToGo,
  timeToGo,
  type MilestoneTile,
} from "../../util/milestoneTiles.js";
import { MilestoneCard } from "../MilestoneCard/MilestoneCard.js";
import { TimeSavedFigure } from "../TimeSavedFigure/TimeSavedFigure.js";
import styles from "./MilestonesSection.module.scss";
import { milestonesSectionTestIds } from "./MilestonesSectionTestIds.js";

export const MILESTONES_STANDFIRST =
  "Time you’ve saved by reading instead of watching. Each milestone takes its colour when you reach it; pick one to see what it was as long as.";

const FLOOD_STAGGER_MS = 260;

const tileName = (tile: MilestoneTile, now: Date): string => {
  if (tile.state !== "reached") {
    return `${tile.milestone.label}, not reached yet, ${spokenTimeToGo(tile.toGo)}`;
  }
  return tile.reachedAt === null
    ? `${tile.milestone.label}, reached`
    : `${tile.milestone.label}, reached ${formatReachedOn(tile.reachedAt, now)}`;
};

// Design 34aj and 34ak (docs/features/time-saved.md, "Settings › Milestones").
export function MilestonesSection() {
  const overviews = useOverviewsWithStateQuery();
  const { minutes } = timeSavedSummary(readableEntries(overviews.data ?? []));
  const milestones = useMilestones(minutes, overviews.isSuccess);
  const analytics = useAnalytics();
  const now = new Date();
  const tiles = milestoneTiles(milestones.marks, minutes);
  const reached = tiles.filter((tile) => tile.state === "reached");
  const next = tiles.find((tile) => tile.state === "next");
  const [picked, setPicked] = useState<MilestoneId | null>(null);
  const shown = reached.find((tile) => tile.milestone.id === picked) ?? reached.at(-1);
  const [floodFrom] = useState(() => milestonesColouredHere());

  useEffect(() => {
    analytics.timeSaved.settingsMilestones.opened();
  }, []);

  const reachedIds = reached.map((tile) => tile.milestone.id).join();
  useEffect(() => {
    if (overviews.isSuccess && reachedIds !== "") {
      rememberMilestonesColoured(reachedIds.split(","));
    }
  }, [overviews.isSuccess, reachedIds]);

  if (overviews.isPending) {
    return <div className={styles.skeleton} data-testid={milestonesSectionTestIds.skeleton} />;
  }

  const flooding = reached.filter((tile) => !floodFrom.has(tile.milestone.id)).map((tile) => tile.milestone.id);

  return (
    <div className={styles.root} data-testid={milestonesSectionTestIds.root}>
      <div className={styles.panel}>
        <p className={styles.label}>Time saved</p>
        <div className={styles.totalRow}>
          <p className={styles.figure} aria-label={spokenTimeSaved(minutes)} data-testid={milestonesSectionTestIds.figure}>
            <TimeSavedFigure minutes={minutes} />
          </p>
          <p className={styles.count} data-testid={milestonesSectionTestIds.count}>
            {reached.length} of {MILESTONES.length} milestones
          </p>
        </div>
        {next?.state === "next" ? (
          <div className={styles.nextProgress} style={milestoneColourStyle(next.milestone.id)} data-testid={milestonesSectionTestIds.next}>
            <div className={styles.nextHead}>
              <span className={styles.nextLabel}>
                Next: <span className={styles.nextName}>{next.milestone.label}</span>
              </span>
              <span className={styles.toGo}>{timeToGo(next.toGo)}</span>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={`Progress to ${next.milestone.label}`}
              aria-valuemin={next.from}
              aria-valuemax={next.milestone.minutes}
              aria-valuenow={minutes}
            >
              <div
                className={styles.bar}
                style={{ width: `${((minutes - next.from) / (next.milestone.minutes - next.from)) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <p className={styles.toGo}>Every milestone reached, for now.</p>
        )}
      </div>

      <div className={styles.group}>
        <p className={styles.label}>Milestones</p>
        <div className={styles.tiles} role="group" aria-label="Milestones" data-testid={milestonesSectionTestIds.tiles}>
          {tiles.map((tile) => {
            const id = tile.milestone.id;
            const isReached = tile.state === "reached";
            const isShown = shown?.milestone.id === id;
            const flood = flooding.indexOf(id);
            return (
              <button
                key={id}
                type="button"
                className={`${styles.tile} ${styles[tile.state]}`}
                style={
                  {
                    ...milestoneColourStyle(id),
                    ...(flood >= 0 ? { "--flood-delay": `${flood * FLOOD_STAGGER_MS}ms` } : {}),
                  } as CSSProperties
                }
                aria-label={tileName(tile, now)}
                aria-pressed={isReached ? isShown : undefined}
                aria-disabled={isReached ? undefined : true}
                onClick={() => {
                  if (isReached && !isShown) {
                    setPicked(id);
                    analytics.timeSaved.settingsMilestones.milestonePicked({ milestone: id });
                  }
                }}
                data-state={tile.state}
                data-testid={milestonesSectionTestIds.tile(id)}
              >
                {isReached && (
                  <span className={`${styles.fill} ${flood >= 0 ? styles.flood : ""}`} aria-hidden="true" />
                )}
                <span className={styles.tileName} aria-hidden="true">
                  {tile.milestone.label}
                </span>
                <span className={styles.tileDetail} aria-hidden="true">
                  {tile.state === "reached" ? (
                    <span className={styles.reachedOn}>
                      {tile.reachedAt === null ? "Reached" : formatReachedOn(tile.reachedAt, now)}
                    </span>
                  ) : (
                    <span className={styles.tileToGo}>{timeToGo(tile.toGo)}</span>
                  )}
                  {tile.state === "next" && (
                    <span className={styles.tileTrack}>
                      <span
                        className={styles.tileBar}
                        style={{ width: `${((minutes - tile.from) / (tile.milestone.minutes - tile.from)) * 100}%` }}
                      />
                    </span>
                  )}
                </span>
                {isShown && (
                  <span className={styles.tick} aria-hidden="true">
                    <StrokeIcon name="check" size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {shown !== undefined && (
        <div data-testid={milestonesSectionTestIds.card}>
          <MilestoneCard
            key={shown.milestone.id}
            milestone={shown.milestone}
            minutes={shown.milestone.minutes}
            {...(shown.state === "reached" && shown.reachedAt !== null
              ? { reachedOn: formatReachedOn(shown.reachedAt, now) }
              : {})}
            onLineChosen={(by) => milestones.lineChosen(shown.milestone.id, by)}
          />
        </div>
      )}

      <div className={styles.panel}>
        <div className={styles.switchRow}>
          <span className={styles.switchText}>
            <span className={styles.switchLabel} id="milestones-switch-label">
              Show milestone cards
            </span>
            <span className={styles.switchHint} id="milestones-switch-hint">
              In the list, on your phone and in the extension, for 24 hours each. They always appear here.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={milestones.cardsShown}
            aria-labelledby="milestones-switch-label"
            aria-describedby="milestones-switch-hint"
            onClick={() => milestones.showCards(!milestones.cardsShown)}
            data-testid={milestonesSectionTestIds.cardsSwitch}
          >
            <span className={styles.knob} />
          </button>
        </div>
      </div>
    </div>
  );
}
