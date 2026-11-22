import type { NarrationRender, NarrationVoice, VoiceSample } from "@overview/domain";

export type NarrationPriority = "interactive" | "background";

// The chosen voice, or the one an older note was narrated in (docs/features/narration-voice.md).
export interface VoicedNarration {
  voice: NarrationVoice;
  render: NarrationRender;
}

// `peek` queues nothing, so a note can tell whether its audio exists before anybody presses play.
export interface NarrationApi {
  peek(lines: readonly string[], voice: NarrationVoice): Promise<VoicedNarration | null>;
  request(lines: readonly string[], voice: NarrationVoice, priority: NarrationPriority): Promise<NarrationRender>;
  status(key: string): Promise<NarrationRender>;
  discard(key: string): Promise<void>;
  samples(): Promise<VoiceSample[]>;
  fileUrl(playable: { fileUrl: string }): string;
}
