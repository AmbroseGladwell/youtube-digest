import { providerHostPermission, type Provider } from "@overview/domain";
import type { ProviderPermissions } from "@overview/app-core";

// One at a time, from the Save press: docs/features/byo-providers.md, "What the extension has to ask for".
export const chromeProviderPermissions: ProviderPermissions = {
  granted: (provider: Provider) => chrome.permissions.contains({ origins: [providerHostPermission(provider)] }),
  request: (provider: Provider) => chrome.permissions.request({ origins: [providerHostPermission(provider)] }),
  drop: async (provider: Provider) => {
    await chrome.permissions.remove({ origins: [providerHostPermission(provider)] });
  },
};
