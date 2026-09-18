// Top level, not onInstalled: this re-runs on every worker start, so the toolbar icon keeps
// opening the panel even if the flag doesn't survive a profile restart or an update.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
