/**
 * @fileoverview This script is injected into the page to create the UI for clipping elements.
 * It handles the clipping functionality and communicates with the background script.
 */

// #region Global Variables

/**
 * Tracks if we're in clipping mode.
 * @type {boolean}
 */
let isClippingMode = false;

/**
 * Tracks the element currently being hovered over.
 * @type {HTMLElement|null}
 */
let currentElement = null;

/**
 * The page overlay element. When not in clipping mode this is null.
 * @type {HTMLElement|null}
 */
let overlay = null;

const CLIP_HELPER_TEXT = 'Click on any element to clip it.';
const CLIP_HELPER_TEXT_CLIPPED = 'Clipped!';

// #endregion

// #region Helper Classes

/**
 * Class representing the metadata of the page.
 */
class PageMetaData {
  title = document.title;
  url = window.location.href;
  keywords = [];
  image = '';
  content = '';
  
  /**
   * Creates an instance of PageMetaData.
   */
  constructor() {

    // Extract meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      this.keywords = metaKeywords.content.split(',').map(k => k.trim()).slice(0, 3);
    }

    // Try multiple meta image sources
    const ogImage = document.querySelector('meta[property="og:image"]');
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    const msImage = document.querySelector('meta[name="msapplication-TileImage"]');

    this.image = ogImage?.content || twitterImage?.content || msImage?.content || '';

    // If no keywords found, generate from meta description or content
    if (this.keywords.length === 0) {
      const metaDesc = document.querySelector('meta[name="description"]')?.content;
      const contentWords = (metaDesc || document.body.textContent)
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3)
        .filter((word, i, arr) => arr.indexOf(word) === i)
        .slice(0, 3);
      this.keywords = contentWords;
      this.content = getMainContent();
    }

  }
}

/**
 * Class representing the content of a clipped element.
 */
class ElementContent {
  type = 'element';
  html = '';
  text = '';
  image = '';
  
  /**
   * Creates an instance of ElementContent.
   * @param {HTMLElement} element The HTML element to extract content from.
   */
  constructor(element) {
    this.html = element.outerHTML;
    
    const isImage = element.tagName === 'IMG';
    
    // Extract image -- note that an element may contain an image
    this.image = isImage
      ? element.src
      : element.querySelector('img')?.src || '';
      
    // Extract text
    this.text = (isImage
      ? element.alt || 'Image'
      : element.innerText || element.textContent
    ).trim();
  }

}


// #endregion

// #region Helper Functions

/**
 * Gets the main content of the page.
 * @returns {string} The main content of the page.
 */
function getMainContent() {
  // Elements likely to contain main content
  const contentElements = document.querySelectorAll('main, [role="main"], article, .main, #main, .content, #content, .post, .article');

  // If no designated content areas, look at all major blocks
  const blocks = contentElements.length > 0 ?
    contentElements :
    document.querySelectorAll('div, section');

  let bestBlock = null;
  let maxScore = 0;

  blocks.forEach(block => {
    // Skip unwanted elements
    if (block.matches('a[href], nav, header, footer, .nav, .header, .footer, [role="navigation"], [role="banner"], [role="contentinfo"], pre, code, .ad, .advertisement, .pagination, img, table, ol, ul, figure')) {
      return;
    }

    // Calculate text density score
    const text = block.textContent;
    const links = block.getElementsByTagName('a');
    const linkDensity = links.length === 0 ? 0 : links.length / text.length;

    // Score based on text length and link density
    const score = text.length * (1 - linkDensity);

    if (score > maxScore) {
      maxScore = score;
      bestBlock = block;
    }
  });
  
  const mainContent = bestBlock ? bestBlock : document.body;
  const mainContentClone = mainContent.cloneNode(true);
  
  // Remove unwanted content
  mainContentClone.querySelectorAll('script, style, pre, picture, aside').forEach(el => el.remove());

  // collapse whitespace
  return mainContentClone.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * Creates the semitransparent overlay for the entire page and appends
 * it to the body. This includes the helper text.
 * @returns {void}
 */
function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'clipai-overlay';
  overlay.innerHTML = `
    <div class="clipai-helper-text">
      <p>${CLIP_HELPER_TEXT}</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

/**
 * Updates the helper text in the overlay.
 * @param {string} text The text to display.
 * @returns {void}
 */
function updateOverlayText(text) {
  if (!overlay) return;
  const helperText = overlay.querySelector('.clipai-helper-text p');
  if (helperText) {
    helperText.innerText = text;
  }
}

/**
 * Removes the highlight from the current element.
 * @returns {void}
 */
function removeHighlight() {
  if (currentElement) {
    currentElement.classList.remove('clipai-highlight');
    currentElement = null;
  }
  
  if (overlay) {
    overlay.style.display = 'none';
  }
  
  document.body.style.cursor = '';
}

// #endregion

// #region Event Handlers

/**
 * Handles the click event to clip of the current element.
 * @param {MouseEvent} event The mouse event.
 * @returns {void}
 */
function handleClipClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  if (!currentElement) return;

  const metadata = new PageMetaData();

  // Add zoom animation class
  currentElement.classList.add('clipai-clipped');
  
  // currentElement may be null by the time the animation ends
  const lastElement = currentElement;
  currentElement.addEventListener('animationend', () => {
    lastElement.classList.remove('clipai-clipped');
  }, { once: true });
  
  const elementContent = new ElementContent(currentElement);
  const elementText = elementContent.text;
  
  updateOverlayText(CLIP_HELPER_TEXT_CLIPPED);
  
  chrome.runtime.sendMessage({
    action: 'saveClip',
    data: {
      type: 'content',
      metadata: {
        ...metadata,
        title: elementText.substring(0, 50) + (elementText.length > 50 ? '...' : ''),
        image: elementContent.image || metadata.image
      },
      content: elementContent,
      timestamp: new Date().toISOString()
    }
  });

  setTimeout(() => {
    exitClippingMode();
  }, 1000);
}

/**
 * Handles mouse over event to highlight the current element.
 * @param {MouseEvent} event The mouse event.
 * @returns {void}
 */
function handleMouseOver(event) {
  if (!isClippingMode) return;

  // Don't process our own elements
  if (event.target.closest('.clipai-overlay, .clipai-button-container')) {
    return;
  }

  // Remove previous highlight
  if (currentElement) {
    currentElement.classList.remove('clipai-highlight');
  }

  // Update current element
  currentElement = event.target;
  currentElement.classList.add('clipai-highlight');  
}

/**
 * Handles mouse out event to remove highlight from the current element.
 * @param {MouseEvent} event The mouse event.
 * @returns {void}
 */
function handleMouseOut(event) {
  if (!isClippingMode) return;

  const relatedTarget = event.relatedTarget;
  
  // Don't remove highlight if moving to/from the clip button or its container
  if (relatedTarget && (
    relatedTarget.closest('.clipai-button-container') ||
    relatedTarget === currentElement ||
    currentElement.contains(relatedTarget)
  )) {
    return;
  }

  if (currentElement) {
    currentElement.classList.remove('clipai-highlight');
    currentElement = null;
  }
}

// Add escape key handler to exit clip mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isClippingMode) {
    isClippingMode = false;
    removeHighlight();
    chrome.runtime.sendMessage({ action: 'clipModeExited' });
  }
});

// #endregion

// #region Clipping Mode Toggles

/**
 * Handles escape key press to exit clipping mode
 * @param {KeyboardEvent} event The keyboard event
 */
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    exitClippingMode();
  }
}

/**
 * Enters clipping mode and sets up the overlay and event listeners.
 * @returns {void}
 */
function enterClippingMode() {
  isClippingMode = true;
  if (!overlay) createOverlay();
  overlay.style.display = 'block';
  document.body.style.cursor = 'crosshair';
  
  // capture all click events
  document.addEventListener('click', handleClipClick, {
    capture: true
  });
  
  // Add escape key handler with capture
  window.addEventListener('keydown', handleEscapeKey, {
    capture: true
  });
}

/**
 * Exits clipping mode and cleans up the overlay and event listeners.
 * @returns {void}
 */
function exitClippingMode() {
  isClippingMode = false;
  if (overlay) overlay.style.display = 'none';
  document.body.style.cursor = '';
  updateOverlayText(CLIP_HELPER_TEXT);
  
  if (currentElement) {
    currentElement.classList.remove('clipai-highlight');
    currentElement = null;
  }

  // remove event listeners
  document.removeEventListener('click', handleClipClick, {
    capture: true
  });
  window.removeEventListener('keydown', handleEscapeKey, {
    capture: true
  });
  
  // Notify sidebar to update UI
  chrome.runtime.sendMessage({ action: 'clipModeExited' });
}

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleClipMode') {
    if (message.enabled) {
      enterClippingMode();
    } else {
      exitClippingMode();
    }
    // No response needed for this action
    return false;
  }
  
  if (message.action === 'getMetadata') {
    console.log('getMetadata');
    sendResponse({ metadata: new PageMetaData() });
    return false; // We've responded synchronously
  }
});

// #endregion

// #region Page Initialization

// Initialize event listeners
document.addEventListener('mouseover', handleMouseOver);
document.addEventListener('mouseout', handleMouseOut);

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
});

// #endregion
