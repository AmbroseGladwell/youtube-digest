// Nothing stores a transcript against an overview yet (docs/features/overview-redesign.md,
// "What was not built"). These rows exist so the tab's design is built and reviewable;
// they are replaced wholesale the moment the transcript is persisted, and the panel says
// on screen that they are placeholder rather than passing them off as the real thing.
export interface PlaceholderTranscriptRow {
  time: string;
  text: string;
}

export const PLACEHOLDER_TRANSCRIPT: PlaceholderTranscriptRow[] = [
  { time: "0:00", text: "Placeholder transcript line. Timed caption text will sit here, one row per caption cue." },
  { time: "0:26", text: "Placeholder transcript line. Tapping a row is what will move the read-along to that point." },
  { time: "1:04", text: "Placeholder transcript line. The row being read carries the same rule and wash as the note." },
  { time: "1:48", text: "Placeholder transcript line. Long cues wrap under the timestamp rather than truncating." },
  { time: "2:31", text: "Placeholder transcript line. The timestamp column is tabular so the times line up." },
  { time: "3:09", text: "Placeholder transcript line. Rows are separated by hairlines, not boxes." },
  { time: "3:52", text: "Placeholder transcript line. The list scrolls inside the panel on a phone." },
  { time: "4:30", text: "Placeholder transcript line. The last cue ends where the video ends." },
];
