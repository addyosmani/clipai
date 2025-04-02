let isClippingMode = false;
let currentElement = null;
let clipButton = null;
let overlay = null;
let helperText = null;

function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'clipai-overlay';
  
  helperText = createHelperText();
  overlay.appendChild(helperText);
  
  document.body.appendChild(overlay);
}

function createHelperText() {
  const helperText = document.createElement('div');
  helperText.className = 'clipai-helper-text';
  helperText.innerHTML = `
      <p>Click on any element to clip it!</p>
  `;
  return helperText;
}

function createClipButton() {
  const container = document.createElement('div');
  container.className = 'clipai-button-container';
  
  const button = document.createElement('button');
  button.textContent = 'Clip This';
  button.className = 'clipai-button';
  
  container.appendChild(button);
  return container;
}

function extractMetadata() {
  const metadata = {
    title: document.title,
    url: window.location.href,
    keywords: [],
    image: ''
  };

  // Extract meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    metadata.keywords = metaKeywords.content.split(',').map(k => k.trim()).slice(0, 3);
  }

  // Try multiple meta image sources
  const ogImage = document.querySelector('meta[property="og:image"]');
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  const msImage = document.querySelector('meta[name="msapplication-TileImage"]');
  
  metadata.image = ogImage?.content || twitterImage?.content || msImage?.content || '';

  // If no keywords found, generate from meta description or content
  if (metadata.keywords.length === 0) {
    const metaDesc = document.querySelector('meta[name="description"]')?.content;
    const contentWords = (metaDesc || document.body.textContent)
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .filter((word, i, arr) => arr.indexOf(word) === i)
      .slice(0, 3);
    metadata.keywords = contentWords;
  }

  return metadata;
}

function handleClip(event) {
  event.preventDefault();
  event.stopPropagation();
  
  if (!currentElement) return;

  const metadata = extractMetadata();

  // Enhanced content extraction
  let elementImage = '';
  if (currentElement.tagName === 'IMG') {
    elementImage = currentElement.src;
  } else {
    const img = currentElement.querySelector('img');
    if (img) elementImage = img.src;
  }

  // Extract text content based on element type
  let elementText = '';
  if (currentElement.tagName === 'IMG') {
    elementText = currentElement.alt || 'Image';
  } else {
    elementText = currentElement.innerText || currentElement.textContent;
  }

  // Add zoom animation class
  currentElement.classList.add('clipai-clipped');
  currentElement.addEventListener('animationend', () => {
    currentElement.classList.remove('clipai-clipped');
  }, { once: true });
  
  
  const elementContent = {
    type: 'element',
    html: currentElement.outerHTML,
    text: elementText.trim(),
    image: elementImage
  };

  chrome.runtime.sendMessage({
    action: 'saveClip',
    data: {
      type: 'content',
      metadata: {
        ...metadata,
        title: elementText.substring(0, 50) + (elementText.length > 50 ? '...' : ''),
        image: elementImage || metadata.image
      },
      content: elementContent,
      timestamp: new Date().toISOString()
    }
  });

  // Visual feedback
  const button = clipButton.querySelector('.clipai-button');
  button.textContent = 'Clipped!';
  button.style.backgroundColor = '#10B981';
  
  setTimeout(() => {
    exitClippingMode();
  }, 1000);
}

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
  
  // Create or update helper text
  // if (!helperText) {
  //   helperText = createHelperText();
  //   document.body.appendChild(helperText);
  // }

  // // Create or update clip button
  // if (!clipButton) {
  //   clipButton = createClipButton();
  //   clipButton.querySelector('.clipai-button').addEventListener('click', handleClip);
  //   document.body.appendChild(clipButton);
  // }

  // Add button container directly to the element
  // currentElement.style.position = 'relative';
  // currentElement.appendChild(clipButton);
}

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
    if (clipButton && clipButton.parentNode) {
      clipButton.parentNode.removeChild(clipButton);
      clipButton = null;
    }
    currentElement = null;
  }
}

function enterClippingMode() {
  isClippingMode = true;
  if (!overlay) createOverlay();
  overlay.style.display = 'block';
  document.body.style.cursor = 'crosshair';
  
  // capture all click events
  document.addEventListener('click', handleClip, {
    capture: true
  });
}

function exitClippingMode() {
  isClippingMode = false;
  if (overlay) overlay.style.display = 'none';
  document.body.style.cursor = '';
  
  if (currentElement) {
    currentElement.classList.remove('clipai-highlight');
    if (clipButton && clipButton.parentNode) {
      clipButton.parentNode.removeChild(clipButton);
      clipButton = null;
    }
    currentElement = null;
  }

  // remove click event listener
  document.removeEventListener('click', handleClip, {
    capture: true
  });
  
  // Notify sidebar to update UI
  chrome.runtime.sendMessage({ action: 'clipModeExited' });
}

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleClipMode') {
    if (message.enabled) {
      enterClippingMode();
    } else {
      exitClippingMode();
    }
  }
});

// Initialize event listeners
document.addEventListener('mouseover', handleMouseOver);
document.addEventListener('mouseout', handleMouseOut);

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
});
