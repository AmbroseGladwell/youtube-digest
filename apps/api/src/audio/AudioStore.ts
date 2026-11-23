export interface AudioStore {
  put(key: string, audio: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  putSegment(key: string, index: number, audio: Buffer): Promise<void>;
  getSegment(key: string, index: number): Promise<Buffer | null>;
  deleteSegments(key: string): Promise<void>;
}
