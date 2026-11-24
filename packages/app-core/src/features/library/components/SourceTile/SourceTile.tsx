import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { LibrarySource, LibrarySourcePlatform } from "../../util/librarySourceOf.js";
import styles from "./SourceTile.module.scss";

const PLATFORM: Record<Exclude<LibrarySourcePlatform, "website">, { colour: string; icon: StrokeIconName }> = {
  youtube: { colour: "#c62f23", icon: "circlePlay" },
  tiktok: { colour: "#2a2a2a", icon: "video" },
  instagram: { colour: "#a62c6e", icon: "video" },
  facebook: { colour: "#1a5fc4", icon: "video" },
  spotify: { colour: "#16753f", icon: "headphones" },
  applePodcasts: { colour: "#7c3fb3", icon: "headphones" },
};

const SITE_COLOURS = ["#b5533c", "#7a5f3c", "#4f7b4f", "#2f7a8c", "#8a4f7d", "#c0392b"];

const siteColour = (name: string): string => {
  let sum = 0;
  for (let index = 0; index < name.length; index += 1) {
    sum += name.charCodeAt(index);
  }
  return SITE_COLOURS[sum % SITE_COLOURS.length]!;
};

export interface SourceTileProps {
  source: Pick<LibrarySource, "name" | "platform">;
  size?: number;
}

// Our own icon for a platform, the first letter for a website; no favicon is ever fetched (design 399s).
export const SourceTile = ({ source, size = 24 }: SourceTileProps) => {
  const known = source.platform === "website" ? null : PLATFORM[source.platform];
  return (
    <span
      className={styles.tile}
      style={{ width: size, height: size, fontSize: `${size / 32}rem`, background: known?.colour ?? siteColour(source.name) }}
      aria-hidden="true"
    >
      {known === null ? source.name.trim().charAt(0).toUpperCase() : <StrokeIcon name={known.icon} size={Math.round(size / 2)} />}
    </span>
  );
};
