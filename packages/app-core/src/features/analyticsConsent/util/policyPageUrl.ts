export type PolicyPage = "privacy" | "terms";

// The policy and terms are web-app pages, so the extension opens them on the server it talks to.
export const policyPageUrl = (apiUrl: string, page: PolicyPage): string => new URL(`/${page}`, apiUrl).toString();
