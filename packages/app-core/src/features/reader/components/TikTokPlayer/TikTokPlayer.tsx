import { useEffect, useRef, type Ref } from "react";
import { formatTimestamp, type TikTokSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { TIKTOK_PLAYER_ORIGIN, tiktokPlayerUrl, type TikTokEngine } from "../../tiktok/TikTokEngine.js";
import { useTikTokSnapshot } from "../../tiktok/useTikTokEngine.js";
import styles from "./TikTokPlayer.module.scss";
import { tiktokPlayerTestIds } from "./TikTokPlayerTestIds.js";

// Docked beside the note on web; above the title with chat open; in the head's place on phone and panel (130h, 130p, 130g-p).
export type TikTokPlayerPlace = "dock" | "stage" | "head";

export interface TikTokPlayerProps {
  engine: TikTokEngine;
  source: TikTokSource;
  place: TikTokPlayerPlace;
  ref?: Ref<HTMLElement> | undefined;
}

const WATCH_ON_TIKTOK = "Watch on TikTok";

const WatchOnTikTok = ({ url }: { url: string }) => (
  <a className={styles.watch} href={url} target="_blank" rel="noopener" data-testid={tiktokPlayerTestIds.watchOnTikTok}>
    {WATCH_ON_TIKTOK}
    <StrokeIcon name="openOut" size={13} />
  </a>
);

const Embed = ({ engine, source }: Pick<TikTokPlayerProps, "engine" | "source">) => {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const element = frame.current;
    if (element === null) {
      return;
    }
    engine.attach({ post: (message) => element.contentWindow?.postMessage(message, TIKTOK_PLAYER_ORIGIN) });
    const heard = (event: MessageEvent) => {
      if (event.origin === TIKTOK_PLAYER_ORIGIN && event.source === element.contentWindow) {
        engine.receive(event.data);
      }
    };
    window.addEventListener("message", heard);
    return () => {
      window.removeEventListener("message", heard);
      engine.attach(null);
    };
  }, [engine]);

  return (
    <iframe
      ref={frame}
      className={styles.frame}
      src={tiktokPlayerUrl(source.id)}
      title={`TikTok video: ${source.title}`}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      data-testid={tiktokPlayerTestIds.frame}
    />
  );
};

export const TikTokPlayer = ({ engine, source, place, ref }: TikTokPlayerProps) => {
  const { status } = useTikTokSnapshot(engine);
  const closed = status === "closed";

  return (
    <section ref={ref} className={`${styles.root} ${styles[place]}`} aria-label="The TikTok" data-testid={tiktokPlayerTestIds.root}>
      {closed && (
        <button
          type="button"
          className={styles.cover}
          onClick={() => engine.play()}
          aria-label="Play the TikTok"
          data-testid={tiktokPlayerTestIds.cover}
        >
          {source.imageUrl !== null && <img className={styles.coverImage} src={source.imageUrl} alt="" />}
          <span className={styles.coverPlay} aria-hidden="true">
            <StrokeIcon name="play" size={14} />
          </span>
        </button>
      )}
      {!closed && status !== "failed" && (
        <div className={styles.player}>
          <Embed engine={engine} source={source} />
        </div>
      )}
      {status === "failed" && (
        <div className={`${styles.player} ${styles.dead}`} role="alert" data-testid={tiktokPlayerTestIds.failed}>
          <p className={styles.deadTitle}>TikTok didn’t load the video here</p>
          <p className={styles.deadBody}>
            It sometimes limits how often its player opens on other sites. Try again in a minute, or watch it on TikTok.
          </p>
          <WatchOnTikTok url={source.url} />
        </div>
      )}
      {status !== "failed" && <WatchOnTikTok url={source.url} />}
    </section>
  );
};

export interface TikTokMiniBarProps {
  engine: TikTokEngine;
  source: TikTokSource;
  onBack: () => void;
}

// Design 130p-3: scrolled away from the player while it plays, a slim bar keeps it within reach.
export const TikTokMiniBar = ({ engine, source, onBack }: TikTokMiniBarProps) => {
  const { status, positionMs, durationMs } = useTikTokSnapshot(engine);
  const playing = status === "playing";
  const lengthMs = durationMs ?? source.durationMs;
  return (
    <div className={styles.mini} data-testid={tiktokPlayerTestIds.miniBar}>
      {source.imageUrl === null ? <i className={styles.miniCover} /> : <img className={styles.miniCover} src={source.imageUrl} alt="" />}
      <button
        type="button"
        className={styles.miniToggle}
        onClick={() => engine.toggle()}
        aria-label={playing ? "Pause the TikTok" : "Play the TikTok"}
        data-testid={tiktokPlayerTestIds.miniToggle}
      >
        <StrokeIcon name={playing ? "pause" : "play"} size={14} />
      </button>
      <span>{formatTimestamp(positionMs)}</span>
      <span className={styles.miniTrack} aria-hidden="true">
        <b style={{ width: lengthMs ? `${Math.min(100, (positionMs / lengthMs) * 100)}%` : "0%" }} />
      </span>
      {lengthMs !== null && <span>{formatTimestamp(lengthMs)}</span>}
      <button type="button" className={styles.backToVideo} onClick={onBack} data-testid={tiktokPlayerTestIds.backToVideo}>
        Back to the video
      </button>
    </div>
  );
};
