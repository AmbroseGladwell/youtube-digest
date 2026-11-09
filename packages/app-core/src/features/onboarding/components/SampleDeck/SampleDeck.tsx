import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Sample } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import { sampleFacts } from "../../util/sampleFacts.js";
import { useStartFromSample } from "../../useStartFromSample.js";
import { SAMPLE_FAILED } from "../OnboardingSamples/OnboardingSamples.js";
import styles from "./SampleDeck.module.scss";
import { sampleDeckTestIds } from "./SampleDeckTestIds.js";

const CYCLE_MS = 6000;
const SWIPE_PX = 70;
const EASE = "cubic-bezier(.2,.7,.2,1)";
const TOP = 22;
const GAP = 8;
const GEOMETRY = {
  wide: { width: 440, listWidth: 440, height: 430, row: 90 },
  phone: { width: 326, listWidth: 350, height: 476, row: 108 },
};

type Layout = "deck" | "gather" | "list" | "stack";

export interface SampleDeckProps {
  samples: readonly Sample[];
  phone: boolean;
  onFront: (sample: Sample) => void;
}

// Design 155l: on the web, Start's samples are a deck in the Example overview card's shape, one
// full card with two behind it, cycling on its own. Hover or focus holds it, Pause stops it for
// the visit, and the arrows step by hand. See all unfolds it into a list in deck order. With
// reduced motion it doesn't cycle until Play, and every change is a crossfade
// (docs/features/onboarding.md, "Try a sample").
export function SampleDeck({ samples, phone, onFront }: SampleDeckProps) {
  const n = samples.length;
  const g = phone ? GEOMETRY.phone : GEOMETRY.wide;
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const headingId = useId();
  const { opening, busy, failed, open } = useStartFromSample();
  const [front, setFrontIndex] = useState(0);
  const [layout, setLayout] = useState<Layout>("deck");
  const [paused, setPaused] = useState(false);
  const [userPlay, setUserPlay] = useState(false);
  const [hold, setHold] = useState(false);
  const [manual, setManual] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [fling, setFling] = useState(0);
  const cards = useRef<Array<HTMLButtonElement | null>>([]);
  const pressed = useRef<number | null>(null);
  const pointer = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const draggedAt = useRef(0);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const later = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const expanded = layout === "list" || layout === "gather";
  const playing = !paused && (!reduced || userPlay);

  const setFront = (index: number, by: { manual: boolean; fling?: number }) => {
    setFrontIndex(index);
    setManual(by.manual);
    setFling(by.fling ?? 0);
    onFront(samples[index]!);
  };
  const step = (by: number) => setFront((front + by + n) % n, { manual: true });

  const cycling = playing && !hold && layout === "deck" && !busy && drag === null;
  const advance = useRef(() => {});
  advance.current = () => setFront((front + 1) % n, { manual: false });
  useEffect(() => {
    if (!cycling) return;
    const next = setTimeout(() => advance.current(), CYCLE_MS);
    return () => clearTimeout(next);
  }, [cycling, front]);

  useEffect(() => {
    if (!failed) return;
    setPaused(true);
    if (pressed.current !== null) cards.current[pressed.current]?.focus();
  }, [failed]);

  const toggleAll = () => {
    if (reduced) {
      setLayout(expanded ? "deck" : "list");
      return;
    }
    if (!expanded) {
      setLayout("gather");
      later(200, () => setLayout("list"));
    } else {
      setLayout("stack");
      later(420 + (n - 1) * 25, () => setLayout("deck"));
    }
  };

  const choose = (index: number) => {
    if (Date.now() - draggedAt.current < 300) return;
    pressed.current = index;
    void open(samples[index]!, index);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (layout !== "deck") return;
    pointer.current = { x: event.clientX, y: event.clientY, horizontal: null };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (p === null) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (p.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      p.horizontal = Math.abs(dx) > Math.abs(dy);
      if (p.horizontal) event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (p.horizontal) {
      setDrag(dx);
      setHold(true);
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    const p = pointer.current;
    pointer.current = null;
    if (p === null || !p.horizontal) return;
    draggedAt.current = Date.now();
    const dx = event.clientX - p.x;
    setDrag(null);
    setHold(false);
    if (Math.abs(dx) > SWIPE_PX) setFront((front + 1) % n, { manual: true, fling: dx < 0 ? -1 : 1 });
  };

  const dragging = drag !== null && layout === "deck";
  const duration = layout === "deck" ? 480 : layout === "gather" ? 220 : 420;
  const width = layout === "list" ? g.listWidth : g.width;
  const motion = reduced
    ? "opacity 120ms linear"
    : `transform ${duration}ms ${EASE}, top ${duration}ms ${EASE}, height ${duration}ms ${EASE}, width ${duration}ms ${EASE}, opacity 240ms ${EASE}, background-color 240ms ${EASE}, box-shadow 240ms ${EASE}`;

  const stageStyle: CSSProperties = {
    width,
    height: layout === "list" ? n * g.row + (n - 1) * GAP : g.height + TOP,
    transition: reduced ? "none" : layout === "list" ? `height ${420 + 60 + (n - 2) * 45}ms ${EASE}` : `height 420ms ${EASE} 120ms`,
  };

  return (
    <section
      className={styles.root}
      aria-roledescription="carousel"
      aria-labelledby={headingId}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHold(false);
      }}
      data-testid={sampleDeckTestIds.root}
    >
      <div className={styles.head}>
        <h2 id={headingId} className={styles.heading}>
          Or try a sample
        </h2>
        <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={toggleAll} data-testid={sampleDeckTestIds.toggle}>
          {!phone && <StrokeIcon name={expanded ? "stack" : "layoutGrid"} size={14} />}
          {expanded ? (phone ? "One at a time" : "Show one at a time") : phone ? `See all ${n}` : `See all ${n} samples`}
        </button>
      </div>
      {failed && (
        <p className={styles.failed} role="alert" data-testid={sampleDeckTestIds.failed}>
          <StrokeIcon name="alert" size={15} />
          {SAMPLE_FAILED}
        </p>
      )}
      <div
        className={styles.stage}
        style={stageStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {samples.map((sample, index) => {
          const slot = (index - front + n) % n;
          const look = placement({ layout, slot, n, g, dragging, drag, fling, reduced });
          const facts = sampleFacts(sample.note);
          const isOpening = opening === sample.token;
          return (
            <button
              key={sample.token}
              ref={(card) => {
                cards.current[index] = card;
              }}
              type="button"
              className={styles.card}
              aria-label={facts.name}
              aria-hidden={look.hidden || undefined}
              aria-busy={isOpening || undefined}
              tabIndex={look.hidden ? -1 : 0}
              onClick={() => choose(index)}
              style={{
                top: look.top,
                width,
                height: look.height,
                background: look.background,
                boxShadow: look.shadow,
                transform: look.transform,
                transformOrigin: "30% 100%",
                opacity: look.opacity,
                zIndex: look.z,
                transition: look.still ? "none" : motion,
                transitionDelay: `${look.delay}ms`,
                pointerEvents: look.hidden ? "none" : "auto",
              }}
              data-testid={sampleDeckTestIds.card}
              data-front={slot === 0 || undefined}
            >
              <span
                className={styles.inner}
                style={{
                  opacity: look.innerOpacity,
                  transition: dragging ? "none" : reduced ? "opacity 120ms linear" : `opacity 240ms ${EASE}`,
                  transitionDelay: `${layout === "list" && slot > 0 && !reduced ? look.delay + 160 : 0}ms`,
                }}
              >
                <span className={styles.top}>
                  <OverviewThumbnail video={sample.note.source} className={phone ? styles.thumbPhone : styles.thumb} />
                  <span className={styles.meta}>
                    <span className={styles.kicker}>{[facts.source, facts.kindLabel, facts.length].filter(Boolean).join(" · ")}</span>
                    <span className={phone ? styles.titlePhone : styles.title}>{sample.note.source.title}</span>
                  </span>
                </span>
                <span
                  className={styles.full}
                  style={{
                    opacity: look.fullOpacity,
                    transition: reduced ? "opacity 120ms linear" : `opacity ${look.fullOpacity ? 240 : 120}ms ${EASE}`,
                    transitionDelay: `${look.fullOpacity && layout === "deck" && !reduced ? 200 : 0}ms`,
                  }}
                >
                  <span className={styles.firstLabel}>{facts.first.label}</span>
                  <span className={styles.firstText}>{facts.first.text}</span>
                  <span className={styles.sections} aria-hidden="true">
                    {facts.sections.map((name) => (
                      <span key={name} className={styles.section}>
                        <span className={styles.sectionHead}>
                          {name}
                          <span className={styles.written}>
                            <StrokeIcon name="check" size={12} />
                            Written
                          </span>
                        </span>
                        <span className={styles.bars}>
                          <span />
                          <span style={{ width: "64%" }} />
                        </span>
                      </span>
                    ))}
                    <span className={styles.fade} />
                  </span>
                  {isOpening ? (
                    <span className={styles.opening} role="status">
                      <StrokeIcon name="loader" size={15} />
                      Opening…
                    </span>
                  ) : (
                    <span className={styles.open}>
                      Open this sample
                      <StrokeIcon name="chevronRight" size={15} />
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {layout === "deck" && (
        <div className={styles.controls}>
          <span className={styles.counter} aria-live={manual ? "polite" : "off"} data-testid={sampleDeckTestIds.counter}>
            Sample {front + 1} of {n}
          </span>
          <span className={styles.buttons}>
            <button
              type="button"
              className={styles.round}
              aria-label="Previous sample"
              onClick={() => step(-1)}
              data-testid={sampleDeckTestIds.previous}
            >
              <StrokeIcon name="chevronLeft" size={phone ? 18 : 16} />
            </button>
            <button
              type="button"
              className={styles.round}
              aria-label={playing ? "Pause samples" : "Play samples"}
              onClick={() => {
                if (playing) setPaused(true);
                else {
                  setPaused(false);
                  setUserPlay(true);
                }
              }}
              data-testid={sampleDeckTestIds.playPause}
            >
              <StrokeIcon name={playing ? "pause" : "play"} size={phone ? 16 : 15} />
            </button>
            <button
              type="button"
              className={styles.round}
              aria-label="Next sample"
              onClick={() => step(1)}
              data-testid={sampleDeckTestIds.next}
            >
              <StrokeIcon name="chevronRight" size={phone ? 18 : 16} />
            </button>
          </span>
        </div>
      )}
    </section>
  );
}

interface Placement {
  top: number;
  height: number;
  transform: string;
  opacity: number;
  z: number;
  background: string;
  shadow: string;
  innerOpacity: number;
  fullOpacity: number;
  delay: number;
  hidden: boolean;
  still: boolean;
}

// Where each card sits, by its place behind the front one: the deck's three, the one leaving,
// the rest waiting out of sight; or squared into a stack, or laid out as rows.
function placement(o: {
  layout: Layout;
  slot: number;
  n: number;
  g: (typeof GEOMETRY)["wide"];
  dragging: boolean;
  drag: number | null;
  fling: number;
  reduced: boolean;
}): Placement {
  const { layout, slot, n, g, dragging, drag, fling, reduced } = o;
  const p: Placement = {
    top: TOP,
    height: g.height,
    transform: "none",
    opacity: 1,
    z: 1,
    background: "var(--card)",
    shadow: "var(--shadow-tile)",
    innerOpacity: 1,
    fullOpacity: 1,
    delay: 0,
    hidden: false,
    still: false,
  };
  const behind = (deep: boolean) => {
    p.transform = deep ? "translate(18px, -18px) rotate(2.2deg)" : "translate(8px, -8px) rotate(1deg)";
    p.background = deep ? "var(--surface)" : "color-mix(in srgb, var(--card), var(--surface) 40%)";
    if (deep) p.shadow = "none";
    p.innerOpacity = 0;
    p.hidden = true;
  };
  if (layout === "list") {
    p.top = slot * (g.row + GAP);
    p.height = g.row;
    p.shadow = "var(--shadow-card)";
    p.fullOpacity = 0;
    p.z = n - slot;
    p.delay = reduced || slot === 0 ? 0 : 60 + (slot - 1) * 45;
    return p;
  }
  if (layout === "gather" || layout === "stack") {
    p.top = 0;
    p.height = g.row;
    p.fullOpacity = 0;
    p.z = n - slot;
    if (slot > 0) {
      p.transform = `translateY(${Math.min(slot, 3) * 5}px)`;
      p.background = slot % 2 ? "color-mix(in srgb, var(--card), var(--surface) 40%)" : "var(--surface)";
      p.shadow = "none";
      p.innerOpacity = 0;
      p.opacity = slot <= 3 ? 1 : 0;
      p.hidden = true;
    }
    p.delay = layout === "stack" && !reduced ? (n - 1 - slot) * 25 : 0;
    return p;
  }
  if (slot === 0) {
    p.z = 10;
    if (dragging && drag !== null) {
      p.transform = `translate(${drag}px, ${Math.abs(drag) * 0.05}px) rotate(${drag * 0.05}deg)`;
      p.still = true;
    }
    return p;
  }
  if (slot === 1) {
    behind(false);
    p.z = 9;
    p.innerOpacity = dragging && drag !== null ? Math.min(1, Math.abs(drag) / 140) : 0;
    return p;
  }
  if (slot === 2) {
    behind(true);
    p.z = 8;
    return p;
  }
  if (slot === n - 1) {
    p.hidden = true;
    p.z = 11;
    p.opacity = 0;
    if (!reduced)
      p.transform = fling ? `translate(${fling * 440}px, 36px) rotate(${fling * 16}deg)` : "translate(-48px, 16px) rotate(-6deg)";
    return p;
  }
  behind(true);
  p.opacity = 0;
  return p;
}
