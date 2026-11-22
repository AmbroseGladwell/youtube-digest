import type { SharedNote } from "@overview/domain";
import { sampleKindOf, type SampleKind } from "./sampleFacts.js";

const ORDER: readonly SampleKind[] = ["video", "article", "podcast", "recipe"];

// The deck holds two of each kind, mixed (327b-3): one of each kind in turn, then again, each kind
// keeping its own order from the list the house account set.
export function mixedByKind<Sample extends { note: SharedNote }>(samples: readonly Sample[]): Sample[] {
  const byKind = new Map<SampleKind, Sample[]>(ORDER.map((kind) => [kind, []]));
  for (const sample of samples) {
    byKind.get(sampleKindOf(sample.note))!.push(sample);
  }
  const mixed: Sample[] = [];
  for (let round = 0; mixed.length < samples.length; round += 1) {
    for (const kind of ORDER) {
      const sample = byKind.get(kind)![round];
      if (sample !== undefined) {
        mixed.push(sample);
      }
    }
  }
  return mixed;
}
