import type { ArticlePlace, ArticleRead } from "@overview/domain";
import type { ActivePage, ArticlePages } from "../../src/app/ArticlePagesContext.js";

export interface IwftArticlePagesConfig {
  page: ActivePage | null;
  granted: boolean;
  read: ArticleRead;
}

// The tab beside the panel, as far as app-core can see one: nothing else can reach chrome.*.
export class IwftArticlePages implements ArticlePages {
  private readonly listeners = new Set<() => void>();
  private page: ActivePage | null;
  private granted: boolean;
  private answer: boolean | null = null;
  private waiting: ((allowed: boolean) => void) | null = null;
  private readResult: ArticleRead;
  private menuRequest: ActivePage | null = null;
  private placeResult: boolean | null = true;
  readonly shown: ArticlePlace[] = [];
  readonly asked: string[] = [];
  reloads = 0;

  constructor({ page, granted, read }: IwftArticlePagesConfig) {
    this.page = page;
    this.granted = granted;
    this.readResult = read;
  }

  private notify = () => {
    for (const listener of this.listeners) listener();
  };

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };
  getPage = (): ActivePage | null => this.page;
  hasAccess = async (): Promise<boolean> => this.granted;
  requestAccess = (url: string): Promise<boolean> => {
    this.asked.push(url);
    if (this.granted) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  };
  read = async (): Promise<ArticleRead> => this.readResult;
  reload = async (): Promise<void> => {
    this.reloads += 1;
  };
  showPlace = async (_tabId: number, place: ArticlePlace): Promise<boolean | null> => {
    this.shown.push(place);
    return this.placeResult;
  };
  takeMenuRequest = (): ActivePage | null => {
    const request = this.menuRequest;
    this.menuRequest = null;
    return request;
  };

  answerChrome = (allowed: boolean): void => {
    this.granted = allowed;
    this.waiting?.(allowed);
    this.waiting = null;
  };
  moveTo = (page: ActivePage | null): void => {
    this.page = page;
    this.notify();
  };
  willRead = (read: ArticleRead): void => {
    this.readResult = read;
  };
  willFindPlaces = (found: boolean | null): void => {
    this.placeResult = found;
  };
  rightClick = (page: ActivePage): void => {
    this.menuRequest = page;
    this.notify();
  };
}
