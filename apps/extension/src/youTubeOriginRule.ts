// Chrome attaches `Origin: chrome-extension://<id>` to the worker's POST, and YouTube
// answers 403 to a player call carrying one — reproducibly, and only to that header:
// absent or https://www.youtube.com both succeed. Origin is a forbidden header, so fetch()
// cannot drop it and this rule has to (docs/features/transcript-retrieval.md).
const RULE_ID = 1;

export const youTubeOriginRule = (
  extensionId: string,
): chrome.declarativeNetRequest.Rule => ({
  id: RULE_ID,
  priority: 1,
  action: {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    requestHeaders: [
      { header: "origin", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
    ],
  },
  // Scoped twice over: only requests this extension makes, and only to YouTube. It must
  // not reach the panel's calls to Anthropic, which carry the user's key.
  condition: {
    initiatorDomains: [extensionId],
    requestDomains: ["youtube.com"],
    resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
  },
});

// Replacing by id rather than adding, so re-running on every worker start cannot
// accumulate duplicates.
export async function installYouTubeOriginRule(): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [youTubeOriginRule(chrome.runtime.id)],
  });
}
