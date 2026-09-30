const SAMPLE_RATE = 8000;
const SAMPLES = 800;

let cached: string | null = null;

// A tenth of a second of 8-bit silence, for starting the audio element inside a tap
// (PlayerEngine's unlock). Built rather than inlined so the header's arithmetic is visible.
export function silentWavDataUri(): string {
  if (cached !== null) return cached;
  const bytes = new Uint8Array(44 + SAMPLES);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) =>
    [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));

  ascii(0, "RIFF");
  view.setUint32(4, 36 + SAMPLES, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, SAMPLES, true);
  bytes.fill(128, 44);

  cached = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
  return cached;
}
