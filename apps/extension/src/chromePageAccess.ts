// Chrome's match patterns take a host but no port, so this is a hostname rather than an origin.
export function pagePermission(pageUrl: string): string | null {
  try {
    const { protocol, hostname } = new URL(pageUrl);
    return protocol === "http:" || protocol === "https:" ? `${protocol}//${hostname}/*` : null;
  } catch {
    return null;
  }
}

// One site at a time, as chromeProviderPermissions asks for one provider. request() must be
// called from a user gesture or Chrome refuses it (docs/features/article-extraction.md).
export const chromePageAccess = {
  granted: async (pageUrl: string): Promise<boolean> => {
    const origin = pagePermission(pageUrl);
    return origin !== null && chrome.permissions.contains({ origins: [origin] });
  },
  request: async (pageUrl: string): Promise<boolean> => {
    const origin = pagePermission(pageUrl);
    return origin !== null && chrome.permissions.request({ origins: [origin] });
  },
};
