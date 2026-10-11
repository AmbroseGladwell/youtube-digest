import { providerHostPermission, type Provider } from "@overview/domain";
import type { ProviderPermissions } from "@overview/app-core";

// Chrome is asked for one provider's address at a time, when its key is added, and given
// it back when the key is removed. The alternative — all six listed as required in the
// manifest — would meet a new reader with a permission sheet naming six companies before
// they had agreed to anything, and would disable the extension on update until they
// accepted it (docs/features/byo-providers.md).
//
// request() must be called from a user gesture or Chrome refuses it outright, which is
// why it hangs off the Save key press rather than anything the panel does on mount.
export const chromeProviderPermissions: ProviderPermissions = {
  granted: (provider: Provider) => chrome.permissions.contains({ origins: [providerHostPermission(provider)] }),
  request: (provider: Provider) => chrome.permissions.request({ origins: [providerHostPermission(provider)] }),
  drop: async (provider: Provider) => {
    await chrome.permissions.remove({ origins: [providerHostPermission(provider)] });
  },
};
