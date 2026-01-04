chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('app/index.html'),
    windowId: tab.windowId
  });
});

