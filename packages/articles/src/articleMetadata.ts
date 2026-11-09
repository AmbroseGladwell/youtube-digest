import { isObject, linkedData, typesOf, type JsonObject } from "./linkedData.js";

export interface ArticleMetadata {
  isDeclaredArticle: boolean;
  author: string | null;
  siteName: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  declaredPaywalled: boolean;
}

const isArticleNode = (node: JsonObject): boolean => typesOf(node).some((type) => /(Article|BlogPosting)$/.test(type));

const nameOf = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value))
    return (
      value
        .map(nameOf)
        .filter((name) => name !== null)
        .join(", ") || null
    );
  return isObject(value) ? nameOf(value.name) : null;
};

const metaContent = (document: Document, selector: string): string | null =>
  document.querySelector(selector)?.getAttribute("content")?.trim() || null;

const isoDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const imageOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(imageOf).find((image) => image !== null) ?? null;
  return isObject(value) ? imageOf(value.url) : null;
};

const secureImage = (href: string | null, pageUrl: string): string | null => {
  if (href === null) return null;
  try {
    const url = new URL(href, pageUrl);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

export function articleMetadata(document: Document, pageUrl: string): ArticleMetadata {
  const article = linkedData(document).find(isArticleNode);
  const free = article?.isAccessibleForFree;
  return {
    isDeclaredArticle: article !== undefined,
    author: nameOf(article?.author) ?? metaContent(document, 'meta[name="author"]'),
    siteName: metaContent(document, 'meta[property="og:site_name"]') ?? nameOf(article?.publisher),
    publishedAt: isoDate(article?.datePublished) ?? isoDate(metaContent(document, 'meta[property="article:published_time"]')),
    imageUrl:
      secureImage(metaContent(document, 'meta[property="og:image:secure_url"]'), pageUrl) ??
      secureImage(metaContent(document, 'meta[property="og:image"]'), pageUrl) ??
      secureImage(metaContent(document, 'meta[name="twitter:image"]'), pageUrl) ??
      secureImage(imageOf(article?.image), pageUrl),
    declaredPaywalled: free === false || (typeof free === "string" && free.toLowerCase() === "false"),
  };
}
