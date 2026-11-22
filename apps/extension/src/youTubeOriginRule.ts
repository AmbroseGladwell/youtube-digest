// docs/features/transcript-retrieval.md, "The Origin header has to be stripped, or YouTube answers 403".
const RULE_ID = 1;

export const youTubeOriginRule = (extensionId: string): chrome.declarativeNetRequest.Rule => ({
  id: RULE_ID,
  priority: 1,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    requestHeaders: [{ header: "origin", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }],
  },
  // It must not reach the panel's calls to a provider, which carry the reader's key.
  condition: {
    initiatorDomains: [extensionId],
    requestDomains: ["youtube.com"],
    resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
  },
});

// By id, so re-running on every worker start can't accumulate duplicates.
export const installYouTubeOriginRule = async (): Promise<void> => {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [youTubeOriginRule(chrome.runtime.id)],
  });
};
