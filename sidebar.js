/**
 * @fileoverview The script that runs the sidebar for ClipAI.
 */

import { createSummarizer, isSummarizerAvailable } from './summarizers.js';

// #region Global Variables

let clips = [];
let searchTerm = '';
let sortOrder = 'new';
let isClippingMode = false;

const SUMMARIZE_LOADING = `
<div class="summarize-loading">
  <svg class="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15 12L12 22L9 12L12 2Z" fill="currentColor" />
    <path d="M2 12L12 15L22 12L12 9L2 12Z" fill="currentColor" />
  </svg>
  <p id="loading-status">Summarizing...</p>
</div>
`;

// #endregion

// show Summarize button if summarizer is available
(async () => {
  if (await isSummarizerAvailable()) {
    document.getElementById('summarize').style.display = '';
  }
})();

// #region Clip Management

/**
 * Load clips from storage and render them.
 * @returns {void}
 */
async function loadClips() {
  const data = await chrome.storage.local.get('clipai_clips');
  clips = data.clipai_clips || [];
  renderClips();
}

/**
 * Filter and sort clips based on search term and sort order.
 * @returns {Array} Filtered and sorted clips.
 */
function filterAndSortClips() {
  let filtered = clips;
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = clips.filter(clip => 
      clip.metadata.title.toLowerCase().includes(term) ||
      clip.metadata.keywords.some(k => k.toLowerCase().includes(term)) ||
      (clip.content?.text || '').toLowerCase().includes(term)
    );
  }

  return filtered.sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return sortOrder === 'new' ? bTime - aTime : aTime - bTime;
  });
}

/**
 * Delete a clip by its ID.
 * @param {string} clipTimestamp The timestamp of the clip to delete
 * @returns {void}
 */
function deleteClip(clipTimestamp) {
  const clipIndex = clips.findIndex(clip => clip.timestamp === clipTimestamp);
  clips.splice(clipIndex, 1);
  chrome.storage.local.set({ clipai_clips: clips });
}

// #endregion

// #region Clip Rendering

/**
 * Create a card element for a clip
 * @param {Object} clip The clip object.
 * @param {number} index The index of the clip. Used for deleting.
 * @returns {HTMLElement} The card element.
 */
function createClipCard(clip) {
  const card = document.createElement('div');
  card.className = 'clip-card';

  const preview = clip.content.image || clip.metadata.image;
  let previewHtml = '';
  
  if (preview) {
    previewHtml = `<img src="${preview}" class="clip-preview" alt="Preview">`;
  } else if (clip.content.text) {
    previewHtml = `<div class="clip-preview">
      <p style="padding: 1rem; margin: 0;">${clip.content.text.substring(0, 150)}...</p>
    </div>`;
  }

  card.innerHTML = `
    ${previewHtml}
    <div class="clip-content">
      <div class="clip-title">${clip.metadata.title}</div>
      <div class="clip-keywords">
        ${clip.metadata.keywords.map(k => `<span class="keyword">${k}</span>`).join('')}
      </div>
      <div class="clip-toolbar">
        <div class="clip-date">${new Date(clip.timestamp).toLocaleDateString()}</div>
        <button class="delete-clip" title="Delete clip" data-clip-timestamp="${clip.timestamp}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;

  card.addEventListener('click', event => {
    
    if (event.target.matches('.delete-clip *')) {
      const clipTimestamp = event.target.dataset.clipTimestamp;
      deleteClip(clipTimestamp);
      event.stopPropagation();
      event.target.closest('.clip-card').remove();
      return;
    }
    
    // Extract URL from content if metadata URL is extension URL
    let url = clip.metadata.url;
    if (url.startsWith('chrome-extension://')) {
      // Try to find a URL in the clipped content
      const urlMatch = clip.content.text.match(/https?:\/\/[^\s<>"]+/);
      if (urlMatch) {
        url = urlMatch[0];
      }
    }
    chrome.tabs.create({ url });
  });

  return card;
}

/**
 * Render the clips in the sidebar.
 * @returns {void}
 */
function renderClips() {
  const container = document.getElementById('clips-container');
  container.innerHTML = '';
  
  const filteredClips = filterAndSortClips();
  filteredClips.forEach((clip) => {
    container.appendChild(createClipCard(clip));
  });
}

// #endregion


// #region Clip Mode Management

/**
 * Sends a message to the content script to toggle clipping mode.
 * @returns {void}
 */
async function sendClipModeChangeMessage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleClipMode',
        enabled: isClippingMode
      });
    }
  } catch (error) {
    console.error('Error sending clip mode change message:', error);
  }
}

/**
 * Enters the clipping mode by updating the UI.
 * @returns {void}
 */
async function enterClipMode() {
  const clipButton = document.getElementById('clip-content');
  isClippingMode = true;

  clipButton.classList.add('active');
  clipButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-2-2-1.5 0-2 .62-2 2s.5 2.5 2 2.5zm0 0L12 17m4-7-1.5-2.5m-1 0L12 5m-1.5 2.5L9 5m4.5 4.5L15 7.5M19 13v6m-2-3h4"/>
    </svg>
    Exit Clip Mode
  `;
}

/**
 * Exits the clipping mode by updating the UI.
 * @returns {void}
 */
function exitClipMode() {
  const clipButton = document.getElementById('clip-content');
  isClippingMode = false;

  clipButton.classList.remove('active');
  clipButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-2-2-1.5 0-2 .62-2 2s.5 2.5 2 2.5zm0 0L12 17m4-7-1.5-2.5m-1 0L12 5m-1.5 2.5L9 5m4.5 4.5L15 7.5M19 13v6m-2-3h4"/>
    </svg>
    Clip Content
  `;
}

/**
 * Toggles the clipping mode in the main content.
 * @returns {void}
 */
function toggleClipMode() {
  isClippingMode = !isClippingMode;

  if (isClippingMode) {
    enterClipMode();
  } else {
    exitClipMode();
  }

  return sendClipModeChangeMessage();
}

// #endregion

// #region Event Handlers

/**
 * Bookmarks the entire page.
 * @returns {Promise<void>}
 */
async function handleBookmarkPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    // Create basic metadata from tab info first
    let metadata = {
      title: tab.title || '',
      url: tab.url || '',
      keywords: [],
      image: tab.favIconUrl || ''
    };

    try {
      // Try to get enhanced metadata from content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMetadata' });
      if (response?.metadata) {
        metadata = {
          ...metadata,
          ...response.metadata,
          // Ensure URL is always from tab to avoid chrome-extension:// URLs
          url: tab.url || ''
        };
      }
    } catch (error) {
      console.warn('Metadata extraction failed, using basic tab info:', error);
    }

    const clip = {
      type: 'page',
      metadata,
      content: {
        type: 'page',
        text: metadata.title,
        image: metadata.image
      },
      timestamp: new Date().toISOString()
    };

    chrome.runtime.sendMessage({
      action: 'saveClip',
      data: clip
    });

    // Visual feedback
    const button = document.getElementById('bookmark-page');
    const originalText = button.innerHTML;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
      Bookmarked!
    `;

    setTimeout(() => {
      button.innerHTML = originalText;
    }, 1500);
  } catch (error) {
    console.error('Error bookmarking page:', error);
  }
}

/**
 * Handles keydown events to exit clip mode when Escape is pressed.
 * @param {KeyboardEvent} event - The keydown event.
 * @returns {void}
 */
function handleEscapeKey(event) {
  if (isClippingMode && event.key === 'Escape') {
    exitClipMode();
    sendClipModeChangeMessage();
  }
}

/**
 * Handles summarizing the first five clips.
 * @returns {Promise<void>}
 */
async function handleSummarize() {
  
  const app = document.getElementById('app');
  const summaryContent = document.getElementById('summary-content');
  
  if (app.classList.contains('summarizing')) {
    console.warn('Already summarizing, ignoring request');
    return;
  }
  
  // get the page content for the first five clips
  const webpages = new Set();
  const clipsToSummarize = clips.slice(0, 5)
    // dedupe by URL to avoid duplicate content
    .filter(clip => {
      if (!webpages.has(clip.metadata.url)) {
        webpages.add(clip.metadata.url);
        return true;
      }

      return false;
    });
    
  if (clipsToSummarize.length === 0) {
    console.warn('No clips to summarize');
    summaryContent.innerHTML = '<p>No clips to summarize</p>';
    return;
  }
    
  const controller = new AbortController();
  const signal = controller.signal;
  
  // setup summarize UI
  summaryContent.innerHTML = SUMMARIZE_LOADING;
  app.classList.add('summarizing');
  document.getElementById('close-summary').addEventListener('click', () => {
    app.classList.remove('summarizing');
    controller.abort("Summarization canceled by user.");
  }, { once: true });
  const loadingStatus = document.getElementById('loading-status');
  
  // create the summarizer instance
  let summarizer;
  
  try {
    console.log('Creating summarizer...');
    summarizer = await createSummarizer({
      onProgress: (e) => {
        const percentage = Math.round((e.loaded / e.total) * 100);
        loadingStatus.innerText = `Downloading model (${percentage}%)`;
      },
      signal
    });
    
    console.log('Using summarizer', summarizer);
  } catch (error) {
    summaryContent.innerHTML = '<p>Summarizer not available</p>';
    console.error('Could not create summarizer', error);
    return;
  }

  const start = Date.now();
  
  console.log('Summarizing webpages...');
  loadingStatus.innerText = 'Summarizing webpages...';

  const summaries = [];
  const summaryLength = clipsToSummarize.length > 2 ? 'short' : 'medium';
  console.log('Summary length:', summaryLength);
  
  // have to do this one at a time because session.prompt() won't parallelize
  for (let i = 0, len = clipsToSummarize.length; i < len; i++) {
    const pageSummary = clipsToSummarize[i];
    console.log(`Summarizing ${pageSummary.metadata.url}...`);
    loadingStatus.innerText = `Summarizing ${i+1} of ${len}...`;
    
    summaries.push(await summarizer.summarize(pageSummary.metadata.content, {
      signal,
      length: summaryLength
    }).catch(err => {
      console.warn(`Skipping summarization of ${pageSummary.metadata.url} due to error:`, err);
      return undefined;
    }));
  }
  
  if (signal.aborted) {
    console.log('Summarization aborted');
    return;
  }

  console.log('Summaries received:', Date.now() - start, summaries);
  console.log('Generating overall summary...');
  loadingStatus.innerHTML = 'Generating overall summary...';
  
  const content = summaries.filter(Boolean).join('\n\n');
  const summary = await summarizer.summarize(content, {
    signal
  });

  console.log('Overall summary received:', Date.now() - start, summary);
  
  if (!signal.aborted) {
    summaryContent.innerHTML = `<p>${summary}</p>`;
    summarizer.destroy();
  }
  
}

// #endregion

// #region Event Handler Assignment

document.getElementById('search').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderClips();
});

document.getElementById('sort').addEventListener('change', (e) => {
  sortOrder = e.target.value;
  renderClips();
});

document.getElementById('bookmark-page').addEventListener('click', handleBookmarkPage);
document.getElementById('clip-content').addEventListener('click', toggleClipMode);
document.getElementById('summarize').addEventListener('click', () => {
  handleSummarize();
});

document.addEventListener('keydown', handleEscapeKey, {
  capture: true,
});

// Listen for messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'clipAdded') {
    loadClips();
  } else if (message.action === 'clipModeExited') {
    exitClipMode();
  }
});

// #endregion

// Initial load
loadClips();
