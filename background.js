/**
 * @fileoverview Background script for the Chrome extension. 
 * It handles storage and messaging.
 */

import { pipeline } from '@huggingface/transformers';

// #region Constants

const STORAGE_KEY = 'clipai_clips';
const MAX_SYNC_BYTES = 102400; // 100KB limit for sync storage

// #endregion



chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// #region Clip Management

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

// #endregion

// #region T5 Model Integration

// Map length option to appropriate min and max length values
const t5LengthOptions = new Map([
  ['short', { min_length: 30, max_length: 100 }],
  ['medium', { min_length: 50, max_length: 200 }],
  ['long', { min_length: 100, max_length: 400 }]
]);

let summarizer;

/**
 * Initializes the T5 model pipeline.
 * @param {string} modelId The ID of the T5 model to use.
 * @returns {Promise<void>} The T5 model pipeline.
 */
async function initT5Pipeline(modelId) {
  try {
    summarizer = await pipeline('summarization', modelId);
  } catch (error) {
    console.error('Error initializing T5 pipeline:', error);
    throw error;
  }
}
// #endregion

// Listen for messages from the content script or sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message);
  if (message.action.startsWith('t5:')) {
    switch (message.action) {
      case 't5:init':
        // Initialize T5 model pipeline
        initT5Pipeline(message.modelId)
          .then(() => sendResponse({ status: 'initialized' }))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates async response
        
      case 't5:summarize': {
        // Summarize text using T5 model
        if (!summarizer) {
          sendResponse({ error: 'T5 model not initialized' });
          return false;
        }
        
        const { input, length } = message.data;
        const lengthOptions = t5LengthOptions.get(length);
        
        summarizer(`summarize: ${input}`, lengthOptions)
          .then((summary) => sendResponse({ summary: summary[0].summary_text }))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates async response
      }
    }
  }
  
  
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
