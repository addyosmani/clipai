/**
 * @fileoverview Background script for the Chrome extension. 
 * It handles storage, messaging, and script injection.
 */

// #region Constants

const STORAGE_KEY = 'clipai_clips';
const MAX_SYNC_BYTES = 102400; // 100KB limit for sync storage

// #endregion

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

/**
 * Saves clips to storage, either sync or local based on size.
 * @param {Array<Object>} clips The clips to save.
 * @returns {Promise<void>}
 */
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

/**
 * Retrieves clips from storage, prioritizing sync storage.
 * @returns {Promise<Array<Object>>}
 */
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

/**
 * Checks if the content script is already injected.
 * @param {number} tabId The ID of the tab to check.
 * @returns {Promise<boolean>}
 */
async function scriptAlreadyInjected(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!document.querySelector('.clipai-script-injected')
  });
  return result[0].result;
}

/**
 * Injects the content script and CSS into the active tab.
 * @param {number} tabId The ID of the tab to inject into.
 * @returns {Promise<void>}
 */
async function injectContentScript(tabId) {
  try {
    
    if (scriptAlreadyInjected(tabId)) {
      return;
    }
    
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
