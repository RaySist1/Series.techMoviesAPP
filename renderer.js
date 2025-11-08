// Renderer process script for custom browser UI
const { ipcRenderer } = require('electron');

let currentUrl = 'https://seriestechmovies.site';

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const goButton = document.getElementById('goButton');
  const backButton = document.getElementById('backButton');
  const forwardButton = document.getElementById('forwardButton');
  const refreshButton = document.getElementById('refreshButton');

  // Set initial URL
  urlInput.value = currentUrl;

  // Go button click handler
  goButton.addEventListener('click', () => {
    navigateToUrl();
  });

  // Enter key handler for URL input
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      navigateToUrl();
    }
  });

  // Navigation buttons
  backButton.addEventListener('click', () => {
    ipcRenderer.send('go-back');
    updateNavigationButtons();
  });

  forwardButton.addEventListener('click', () => {
    ipcRenderer.send('go-forward');
    updateNavigationButtons();
  });

  refreshButton.addEventListener('click', () => {
    ipcRenderer.send('refresh');
  });

  // Listen for URL changes from main process
  ipcRenderer.on('url-changed', (event, url) => {
    currentUrl = url;
    urlInput.value = url;
    updateNavigationButtons();
  });

  // Listen for navigation state changes
  ipcRenderer.on('navigation-state', (event, state) => {
    backButton.disabled = !state.canGoBack;
    forwardButton.disabled = !state.canGoForward;
  });

  function navigateToUrl() {
    let url = urlInput.value.trim();
    
    // Add https:// if no protocol is specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    currentUrl = url;
    ipcRenderer.send('navigate', url);
  }

  function updateNavigationButtons() {
    // Request current navigation state
    ipcRenderer.send('get-url');
  }

  // Periodically update navigation buttons
  setInterval(() => {
    updateNavigationButtons();
  }, 500);
});

