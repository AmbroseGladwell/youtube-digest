import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import styles from "./OnboardingCarousel.module.scss";
import { onboardingCarouselTestIds } from "./OnboardingCarouselTestIds.js";

export const CAROUSEL_ADVANCE_MS = 4500;
const PHONE_QUERY = "(max-width: 47.9375rem)";

export interface OnboardingCarouselProps {
  label: string;
  slideLabels: readonly string[];
  children: ReactNode;
}

// On a phone the examples swipe one at a time instead of scrolling the page (OV-411); wider, they sit side by side.
export const OnboardingCarousel = ({ label, slideLabels, children }: OnboardingCarouselProps) => {
  const slides = Children.toArray(children);
  const n = slides.length;
  const phone = useMediaQuery(PHONE_QUERY);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const track = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPlay, setUserPlay] = useState(false);
  const [holding, setHolding] = useState(false);

  const playing = phone && n > 1 && !paused && (!reduced || userPlay);

  const slideEls = (): HTMLElement[] => Array.from(track.current?.children ?? []) as HTMLElement[];

  const show = (index: number) => {
    const target = slideEls()[index];
    if (track.current === null || target === undefined) {
      return;
    }
    track.current.scrollTo({ left: target.offsetLeft, behavior: reduced ? "auto" : "smooth" });
  };

  useEffect(() => {
    if (!playing || holding) {
      return;
    }
    const next = setTimeout(() => show((current + 1) % n), CAROUSEL_ADVANCE_MS);
    return () => clearTimeout(next);
  }, [playing, holding, current, n]);

  const onScroll = () => {
    const el = track.current;
    if (el === null) {
      return;
    }
    const distances = slideEls().map((slide) => Math.abs(slide.offsetLeft - el.scrollLeft));
    setCurrent(distances.indexOf(Math.min(...distances)));
  };

  if (!phone || n < 2) {
    return <div className={styles.grid}>{slides}</div>;
  }

  return (
    <section className={styles.root} aria-roledescription="carousel" aria-label={label} data-testid={onboardingCarouselTestIds.root}>
      <div
        ref={track}
        className={styles.track}
        tabIndex={0}
        onScroll={onScroll}
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onFocus={() => setHolding(true)}
        onBlur={() => setHolding(false)}
        aria-live={playing ? "off" : "polite"}
        data-testid={onboardingCarouselTestIds.track}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${n}: ${slideLabels[index] ?? ""}`}
            aria-hidden={index === current ? undefined : true}
            data-testid={onboardingCarouselTestIds.slide}
          >
            {slide}
          </div>
        ))}
      </div>
      <div className={styles.controls}>
        <span className={styles.dots}>
          {slideLabels.map((slideLabel, index) => (
            <button
              key={slideLabel}
              type="button"
              className={styles.dotButton}
              aria-label={`Show ${slideLabel}`}
              aria-current={index === current ? "true" : undefined}
              onClick={() => show(index)}
              data-testid={onboardingCarouselTestIds.dot}
            >
              <span className={styles.dot} />
            </button>
          ))}
        </span>
        <button
          type="button"
          className={styles.round}
          aria-label={playing ? "Pause examples" : "Play examples"}
          onClick={() => {
            if (playing) {
              setPaused(true);
            } else {
              setPaused(false);
              setUserPlay(true);
            }
          }}
          data-testid={onboardingCarouselTestIds.playPause}
        >
          <StrokeIcon name={playing ? "pause" : "play"} size={16} />
        </button>
      </div>
    </section>
  );
};
