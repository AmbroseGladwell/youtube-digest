const TRACKING_PARAMETERS = new Set([
  "cmpid", "dclid", "fbclid", "gbraid", "gclid", "gclsrc", "igshid", "mc_cid", "mc_eid", "msclkid",
  "ocid", "smid", "twclid", "wbraid", "yclid", "_ga", "_gl",
]);

const isTracking = (name: string): boolean => name.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(name.toLowerCase());

const parsedWebUrl = (href: string, base?: string): URL | null => {
  try {
    const url = new URL(href, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

// A home page named as the canonical of an article is a site's template misfiring, and would
// make every article on that site one item (docs/features/article-extraction.md).
export function canonicalArticleUrl(pageUrl: string, declaredCanonical: string | null): string {
  const page = parsedWebUrl(pageUrl);
  if (page === null) return pageUrl;
  const declared = declaredCanonical === null ? null : parsedWebUrl(declaredCanonical, page.href);
  const namesTheHomePageOfAnArticle = declared?.pathname === "/" && page.pathname !== "/";
  const url = declared === null || namesTheHomePageOfAnArticle ? page : declared;
  for (const name of [...url.searchParams.keys()]) {
    if (isTracking(name)) url.searchParams.delete(name);
  }
  url.hash = "";
  return url.href;
}
