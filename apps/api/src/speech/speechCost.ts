import type { SpeechHost } from "../audio/Narrator.js";
import { gpuDollarsPerHour } from "../costs/gpuDollarsPerHour.js";

export type HostPrices = Record<SpeechHost, number | null>;

const SECONDS_PER_HOUR = 3600;

// Fly's details keep their names from OV-418; Modal's say so, which is how its month's spend is found.
export const speechDetail = (detail: string, host: SpeechHost): string => (host === "modal" ? `${detail}-modal` : detail);

export const speechDollars = (seconds: number, dollarsPerHour: number): number => (seconds * dollarsPerHour) / SECONDS_PER_HOUR;

// Modal reports the card it got; an A10 or L4 instead of a T4 costs more (OV-423).
export const hostPrice = (prices: HostPrices, host: SpeechHost, gpu: string | null): number | null =>
  host === "modal" && gpu !== null ? gpuDollarsPerHour(gpu) : prices[host];
