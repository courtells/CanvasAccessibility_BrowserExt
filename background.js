// Open the side panel by explicitly handling the toolbar click, rather than
// via sidePanel.setPanelBehavior's automatic "open on click" shortcut.
// This matters: Chrome only grants activeTab access for the clicked tab when
// the click is handled directly like this — the automatic-open shortcut does
// not count as the same kind of user gesture, so scripting.executeScript
// would otherwise fail with a permission error.
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
