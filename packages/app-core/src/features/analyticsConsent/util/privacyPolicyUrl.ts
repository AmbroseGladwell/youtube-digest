// The policy is a page of the web app, so the extension opens it on the server it talks to.
export const privacyPolicyUrl = (apiUrl: string): string => new URL("/privacy", apiUrl).toString();
