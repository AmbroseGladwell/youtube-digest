import type { SpeechHost } from "../audio/Narrator.js";

export type HostPrices = Record<SpeechHost, number | null>;

const SECONDS_PER_HOUR = 3600;

// Fly's details keep their names from OV-418; Modal's say so, which is how its month's spend is found.
export const speechDetail = (detail: string, host: SpeechHost): string => (host === "modal" ? `${detail}-modal` : detail);

export const speechDollars = (seconds: number, dollarsPerHour: number): number => (seconds * dollarsPerHour) / SECONDS_PER_HOUR;
