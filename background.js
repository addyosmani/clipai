const STORAGE_KEY = 'clipai_clips';
const MAX_SYNC_BYTES = 102400; // 100KB limit for sync storage

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

async function saveToStorage(clips) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(clips)).length;
    if (bytes < MAX_SYNC_BYTES) {
      await chrome.storage.sync.set({ [STORAGE_KEY]: clips });
    } else {
      await chrome.storage.local.set({ [STORAGE_KEY]: clips });
    }
  } catch (error) {
    console.error('Storage error:', error);
    // Fallback to local storage
    await chrome.storage.local.set({ [STORAGE_KEY]: clips });
  }
}

async function getClips() {
  try {
    const syncData = await chrome.storage.sync.get(STORAGE_KEY);
    if (syncData[STORAGE_KEY]) {
      return syncData[STORAGE_KEY];
    }
    const localData = await chrome.storage.local.get(STORAGE_KEY);
    return localData[STORAGE_KEY] || [];
  } catch (error) {
    console.error('Error getting clips:', error);
    return [];
  }
}

// Inject content script when needed
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css']
    });
  } catch (error) {
    console.error('Error injecting content script:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveClip') {
    getClips().then(clips => {
      clips.unshift(message.data);
      return saveToStorage(clips);
    }).then(() => {
      // Notify sidebar to update
      chrome.runtime.sendMessage({ action: 'clipAdded' });
    });
    return true; // Keep message channel open
  } else if (message.action === 'injectContentScript') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab) {
          return injectContentScript(tab.id);
        }
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Injection error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open
  } else if (message.action === 'getMetadata') {
    // Forward metadata requests to content script
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab) {
          return chrome.tabs.sendMessage(tab.id, message);
        }
      })
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        console.error('Metadata error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open
  }
});
