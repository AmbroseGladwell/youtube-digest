import type { ArticlePages } from "../../app/ArticlePagesContext.js";

const asked = new Map<string, Promise<boolean>>();

// Chrome only asks inside a click, before the run that reads the page exists, so the answer waits here.
export const rememberPageAccess = (url: string, access: Promise<boolean>): void => void asked.set(url, access);

export const pageAccessFor = (pages: ArticlePages, url: string): Promise<boolean> => asked.get(url) ?? pages.hasAccess(url);
