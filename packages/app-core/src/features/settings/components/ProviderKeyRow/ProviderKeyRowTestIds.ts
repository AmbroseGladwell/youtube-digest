export const providerKeyRowTestIds = {
  root: (provider: string) => `ProviderKeyRow.${provider}.root`,
  inUse: (provider: string) => `ProviderKeyRow.${provider}.inUse`,
  summary: (provider: string) => `ProviderKeyRow.${provider}.summary`,
  remove: (provider: string) => `ProviderKeyRow.${provider}.remove`,
  confirm: (provider: string) => `ProviderKeyRow.${provider}.confirm`,
  confirmRemove: (provider: string) => `ProviderKeyRow.${provider}.confirmRemove`,
  cancelRemove: (provider: string) => `ProviderKeyRow.${provider}.cancelRemove`,
  model: (provider: string) => `ProviderKeyRow.${provider}.model`,
};
