import type { OwnTikTokRead, TikTokPages } from "../../src/app/TikTokPagesContext.js";

export interface IwftTikTokPagesConfig {
  granted: boolean;
  // Whether Chrome's box is answered Allow when the offer asks.
  allows: boolean;
  read: OwnTikTokRead;
}

// The extension's own TikTok read, scripted: what it answers and every time Chrome is asked.
export class IwftTikTokPages implements TikTokPages {
  private granted: boolean;
  private readonly allows: boolean;
  private readonly answer: OwnTikTokRead;
  asked = 0;
  reads: string[] = [];

  constructor({ granted, allows, read }: IwftTikTokPagesConfig) {
    this.granted = granted;
    this.allows = allows;
    this.answer = read;
  }

  hasAccess = async (): Promise<boolean> => this.granted;
  requestAccess = async (): Promise<boolean> => {
    this.asked += 1;
    this.granted = this.granted || this.allows;
    return this.granted;
  };
  read = async (link: string): Promise<OwnTikTokRead> => {
    this.reads.push(link);
    return this.granted ? this.answer : { status: "failed", reason: "no-access" };
  };
}
