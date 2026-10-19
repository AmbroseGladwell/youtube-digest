export interface TranscriptSetEntry {
  url: string;
  chosenFor: string;
}

// docs/architecture/model-comparison.md, "The transcript set".
export const TRANSCRIPT_SET: readonly TranscriptSetEntry[] = [
  { url: "https://www.youtube.com/watch?v=Kwl5xfnGXeY", chosenFor: "1 min fitness clip, one idea" },
  { url: "https://www.youtube.com/watch?v=x9TFKNgaDjo", chosenFor: "9 min solo talk, business" },
  { url: "https://www.youtube.com/watch?v=CZoh4DhJB48", chosenFor: "9 min narrated news explainer, politics" },
  { url: "https://www.youtube.com/watch?v=ZT4kiDO_g7M", chosenFor: "9 min live event cut with podcast, business" },
  { url: "https://www.youtube.com/watch?v=XPJuiZAxPJo", chosenFor: "11 min scripted skits, relationship" },
  { url: "https://www.youtube.com/watch?v=CbNGgh5xWlg", chosenFor: "11 min personal story, parenting" },
  { url: "https://www.youtube.com/watch?v=tXdD-eydL7k", chosenFor: "12 min whiteboard demonstration with children" },
  { url: "https://www.youtube.com/watch?v=9ypqs_2fAl8", chosenFor: "13 min visual design study, watch it anyway yes" },
  { url: "https://www.youtube.com/watch?v=X1WXUqaZRqA", chosenFor: "13 min reaction commentary, watch it anyway yes" },
  { url: "https://www.youtube.com/watch?v=rayrrXot17M", chosenFor: "14 min product review, sound is part of the claim" },
  { url: "https://www.youtube.com/watch?v=bq3-qH-CpYQ", chosenFor: "14 min founder interview, the library's commonest genre" },
  { url: "https://www.youtube.com/watch?v=xJiGHnxpFNQ", chosenFor: "17 min podcast clip, health, judged dubious" },
  { url: "https://www.youtube.com/watch?v=Jab_QOxKEO4", chosenFor: "17 min talking head with worked numbers, finance" },
  { url: "https://www.youtube.com/watch?v=bdGO6Khl2-M", chosenFor: "17 min talking head, health" },
  { url: "https://www.youtube.com/watch?v=H6SiAe-VObA", chosenFor: "19 min evidence review with an interview, fitness" },
  { url: "https://www.youtube.com/watch?v=Cky15wRl1rs", chosenFor: "22 min sports commentary, filed under no topic" },
  { url: "https://www.youtube.com/watch?v=f-Ar8mwm3kQ", chosenFor: "23 min screen-share demonstration, watch it anyway yes" },
  { url: "https://www.youtube.com/watch?v=Fm1IMtsTD1g", chosenFor: "26 min news podcast, politics" },
  { url: "https://www.youtube.com/watch?v=G9P9D9hptq8", chosenFor: "65 min long interview, judged original" },
  { url: "https://www.youtube.com/watch?v=TOk-DUDmN6E", chosenFor: "2 h 22 min parliamentary hearing, many speakers" },
];
