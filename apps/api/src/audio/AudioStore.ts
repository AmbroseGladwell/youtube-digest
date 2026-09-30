// Where rendered narration lives, by key. A file directory in development and R2 in
// production (docs/features/tts-pre-rendered-speech.md, "The API side").
export interface AudioStore {
  put(key: string, audio: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}
