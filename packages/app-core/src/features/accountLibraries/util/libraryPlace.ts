import type { Surface } from "../../../app/SurfaceContext.js";

// Design 47: the web app says "this browser" wherever the extension says "the extension".
export const savedHere = (surface: Surface): string => (surface === "web" ? "in this browser" : "in the extension");

export const signingInHere = (surface: Surface): string => (surface === "web" ? "on this browser" : "to the extension");

export const overviewsNoun = (count: number): string => (count === 1 ? "Overview" : "Overviews");
