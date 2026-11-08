export const CREATE_ACCOUNT_PATH = "/create-account";

export function createAccountLink(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}${CREATE_ACCOUNT_PATH}`;
}
