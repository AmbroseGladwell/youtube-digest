export const narrationVoicePickerTestIds = {
  root: "NarrationVoicePicker.root",
  status: "NarrationVoicePicker.status",
  samplesUnavailable: "NarrationVoicePicker.samplesUnavailable",
  tryAgain: "NarrationVoicePicker.tryAgain",
  row: (voice: string) => `NarrationVoicePicker.row.${voice}`,
  radio: (voice: string) => `NarrationVoicePicker.radio.${voice}`,
  second: (voice: string) => `NarrationVoicePicker.second.${voice}`,
  play: (voice: string) => `NarrationVoicePicker.play.${voice}`,
  stop: (voice: string) => `NarrationVoicePicker.stop.${voice}`,
};
