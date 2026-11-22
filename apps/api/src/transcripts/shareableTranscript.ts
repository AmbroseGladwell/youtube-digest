import type { StoredTranscript } from "@overview/domain";

// A pasted url's share tracker or playlist says something about the reader, so only the video's own is kept.
export const shareableTranscript = (transcript: StoredTranscript): StoredTranscript =>
  transcript.video === undefined
    ? transcript
    : {
        ...transcript,
        video: { ...transcript.video, url: `https://www.youtube.com/watch?v=${encodeURIComponent(transcript.videoId)}` },
      };
