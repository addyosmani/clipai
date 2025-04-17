/**
 * @fileoverview Background script for the Chrome extension. 
 * It handles storage and messaging.
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
    await chrome.storage.local.set({ [STORAGE_KEY]: clips });
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
    const localData = await chrome.storage.local.get(STORAGE_KEY);
    return localData[STORAGE_KEY] || [];
  } catch (error) {
    console.error('Error getting clips:', error);
    return [];
  }
}

// Listen for messages from the content script or sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveClip') {
    // Add new clip to storage
    chrome.storage.local.get('clipai_clips', (data) => {
      const clips = data.clipai_clips || [];
      clips.unshift(message.data);
      chrome.storage.local.set({ clipai_clips: clips }, () => {
        // Notify sidebar that clips have been updated
        chrome.runtime.sendMessage({ action: 'clipAdded' });
      });
    });
  }
});
