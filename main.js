const { app, BrowserWindow, BrowserView, session, ipcMain } = require('electron');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const { fetch } = require('cross-fetch');
const RPC = require('discord-rpc');

// Default landing page
const DEFAULT_LANDING_PAGE = 'https://seriestechmovies.site';

// Discord Rich Presence Configuration
// Replace with your Discord Application ID from https://discord.com/developers/applications
const DISCORD_CLIENT_ID = '1435100685887864943';

// TMDB API Configuration
// Get your API key from https://www.themoviedb.org/settings/api
const TMDB_API_KEY = '815eaea3bdee236720965f52e51400f4'; // Replace with your TMDB API key
const TMDB_API_BASE = 'https://api.themoviedb.org/3';

let mainWindow;
let browserView;
let blocker;
let rpc;
let presenceStartTime = Date.now();
let currentMediaInfo = null; // Cache for current media info

// Initialize ad blocker
async function initializeAdBlocker() {
  // Create blocker instance
  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  
  // Enable blocking for default session
  blocker.enableBlockingInSession(session.defaultSession);
  
  // Enable blocking for BrowserView session
  const browserSession = session.fromPartition('persist:main');
  blocker.enableBlockingInSession(browserSession);
  
  return blocker;
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: 'icon.ico',
    title: 'Series.tech Movies',
    frame: true,
    autoHideMenuBar: false
  });

  // Remove the menu bar completely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Get BrowserView session partition
  const browserSession = session.fromPartition('persist:main');

  // Configure session to block pop-ups for default session
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Block all notifications and other pop-up permissions
    if (permission === 'notifications' || permission === 'geolocation' || permission === 'media') {
      callback(false);
    } else {
      callback(true);
    }
  });

  // Block new window creation (pop-ups) for default session
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // Block notifications and other pop-up permissions
    if (permission === 'notifications') {
      return false;
    }
    return true;
  });

  // Configure BrowserView session to block pop-ups
  browserSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Block all notifications and other pop-up permissions
    if (permission === 'notifications' || permission === 'geolocation' || permission === 'media') {
      callback(false);
    } else {
      callback(true);
    }
  });

  // Block new window creation (pop-ups) for BrowserView session
  browserSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    // Block notifications and other pop-up permissions
    if (permission === 'notifications') {
      return false;
    }
    return true;
  });

  // Create BrowserView for web content (fills entire window)
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      partition: 'persist:main'
    }
  });

  // Set up BrowserView event handlers
  const webContents = browserView.webContents;

  // Handle new window events (pop-ups) - block them
  webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });

  // Handle pop-up windows
  webContents.on('new-window', (event, url) => {
    event.preventDefault();
  });

  // Load default page
  webContents.loadURL(DEFAULT_LANDING_PAGE);

  // Update Discord Rich Presence when URL changes
  webContents.on('did-navigate', (event, url) => {
    console.log('Navigation detected:', url);
    updateDiscordPresence(url);
  });

  webContents.on('did-navigate-in-page', (event, url) => {
    console.log('In-page navigation detected:', url);
    updateDiscordPresence(url);
  });

  // Set BrowserView bounds to fill entire window (no toolbar)
  const { width, height } = mainWindow.getBounds();
  browserView.setBounds({ x: 0, y: 0, width: width, height: height });
  browserView.setAutoResize({ width: true, height: true });

  mainWindow.setBrowserView(browserView);

  // Handle window resize
  function updateBrowserViewBounds() {
    const { width, height } = mainWindow.getBounds();
    browserView.setBounds({ x: 0, y: 0, width: width, height: height });
  }

  mainWindow.on('resize', updateBrowserViewBounds);

  // Handle fullscreen enter/exit to update BrowserView bounds
  mainWindow.on('enter-full-screen', () => {
    updateBrowserViewBounds();
  });

  mainWindow.on('leave-full-screen', () => {
    updateBrowserViewBounds();
  });

  // Handle maximize/restore events
  mainWindow.on('maximize', () => {
    updateBrowserViewBounds();
  });

  mainWindow.on('unmaximize', () => {
    updateBrowserViewBounds();
  });

  // Handle F11 fullscreen using webContents keyboard handling
  // This is more reliable than globalShortcut for F11
  const handleF11 = (event) => {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.setFullScreen(true);
    }
  };

  // Handle F11 from BrowserView (where user interaction happens)
  webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      handleF11();
    }
  });

  // Also handle from main window webContents as fallback
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      handleF11();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserView = null;
  });
}

// Initialize Discord Rich Presence
async function initializeDiscordRPC() {
  try {
    rpc = new RPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      console.log('Discord Rich Presence connected');
      // Set initial presence
      updateDiscordPresence(DEFAULT_LANDING_PAGE);
    });

    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(err => {
      console.error('Discord Rich Presence login failed:', err.message);
      rpc = null;
    });
  } catch (error) {
    console.error('Discord Rich Presence initialization failed:', error.message);
    rpc = null;
  }
}

// Parse URL to extract media ID and type
function parseMediaUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Match /tv/{id}/{season}/{episode} pattern (e.g., /tv/60059/1/2)
    const tvMatch = pathname.match(/^\/tv\/(\d+)\/(\d+)\/(\d+)/);
    if (tvMatch) {
      return {
        id: tvMatch[1],
        type: 'tv',
        season: tvMatch[2],
        episode: tvMatch[3],
        url: url
      };
    }
    
    // Match /movie/{id} pattern (e.g., /movie/12345)
    const movieMatch = pathname.match(/^\/movie\/(\d+)/);
    if (movieMatch) {
      return {
        id: movieMatch[1],
        type: 'movie',
        url: url
      };
    }
    
    // Match /watch/{id} pattern
    const watchMatch = pathname.match(/\/watch\/(\d+)/);
    if (watchMatch) {
      const mediaId = watchMatch[1];
      const hasQueryParams = urlObj.search && urlObj.search.length > 0;
      
      // If URL has query params (like ?s=1&e=1), it's a TV series
      // Otherwise, it's a movie
      const isTV = hasQueryParams;
      const season = urlObj.searchParams.get('s') || null;
      const episode = urlObj.searchParams.get('e') || null;
      
      return {
        id: mediaId,
        type: isTV ? 'tv' : 'movie',
        season: season,
        episode: episode,
        url: url
      };
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Fetch movie details from TMDB
async function fetchMovieDetails(movieId) {
  if (TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
    return null; // API key not configured
  }
  
  try {
    const response = await fetch(`${TMDB_API_BASE}/movie/${movieId}?api_key=${TMDB_API_KEY}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title,
      releaseYear: data.release_date ? new Date(data.release_date).getFullYear() : null,
      type: 'movie'
    };
  } catch (error) {
    console.error('Failed to fetch movie details:', error.message);
    return null;
  }
}

// Fetch TV show details from TMDB
async function fetchTVDetails(tvId, season, episode) {
  if (TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
    return null; // API key not configured
  }
  
  try {
    const response = await fetch(`${TMDB_API_BASE}/tv/${tvId}?api_key=${TMDB_API_KEY}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      title: data.name,
      releaseYear: data.first_air_date ? new Date(data.first_air_date).getFullYear() : null,
      type: 'tv',
      season: season,
      episode: episode
    };
  } catch (error) {
    console.error('Failed to fetch TV details:', error.message);
    return null;
  }
}

// Fetch media info from TMDB based on URL
async function fetchMediaInfo(url) {
  const mediaUrl = parseMediaUrl(url);
  if (!mediaUrl) {
    console.log('No media URL detected from:', url);
    return null;
  }
  
  console.log('Media URL detected:', mediaUrl);
  
  // Check if we already have this info cached (for same ID, type, season, and episode)
  const cacheKey = `${mediaUrl.id}-${mediaUrl.type}-${mediaUrl.season || ''}-${mediaUrl.episode || ''}`;
  if (currentMediaInfo && currentMediaInfo.cacheKey === cacheKey) {
    console.log('Using cached TMDB data');
    return currentMediaInfo.tmdbData;
  }
  
  // Fetch from TMDB
  let tmdbData = null;
  if (mediaUrl.type === 'movie') {
    console.log('Fetching movie details for ID:', mediaUrl.id);
    tmdbData = await fetchMovieDetails(mediaUrl.id);
  } else {
    console.log('Fetching TV details for ID:', mediaUrl.id, 'Season:', mediaUrl.season, 'Episode:', mediaUrl.episode);
    tmdbData = await fetchTVDetails(mediaUrl.id, mediaUrl.season, mediaUrl.episode);
  }
  
  console.log('TMDB data received:', tmdbData);
  
  // Cache the result
  currentMediaInfo = {
    id: mediaUrl.id,
    type: mediaUrl.type,
    season: mediaUrl.season,
    episode: mediaUrl.episode,
    url: url,
    cacheKey: cacheKey,
    tmdbData: tmdbData
  };
  
  return tmdbData;
}

// Update Discord Rich Presence
async function updateDiscordPresence(url) {
  if (!rpc) return;

  try {
    // Reset start time if we're watching a different media
    const mediaUrl = parseMediaUrl(url);
    const cacheKey = mediaUrl ? `${mediaUrl.id}-${mediaUrl.type}-${mediaUrl.season || ''}-${mediaUrl.episode || ''}` : null;
    
    if (mediaUrl && (!currentMediaInfo || currentMediaInfo.cacheKey !== cacheKey)) {
      presenceStartTime = Date.now();
    } else if (!mediaUrl && currentMediaInfo) {
      // Navigated away from watch page, clear cache
      currentMediaInfo = null;
      presenceStartTime = Date.now();
    }

    // Try to fetch media info from TMDB
    let tmdbData = null;
    if (mediaUrl) {
      tmdbData = await fetchMediaInfo(url);
    }

    let details = 'Series.tech Movies';
    let state = 'Browsing';
    let largeImageText = 'Series.tech Movies';
    let smallImageText = 'Series.tech Movies';

    if (tmdbData && tmdbData.title) {
      // We have TMDB data, show the actual title
      const year = tmdbData.releaseYear ? ` (${tmdbData.releaseYear})` : '';
      
      if (tmdbData.type === 'movie') {
        details = tmdbData.title + year;
        state = 'Watching a movie';
        largeImageText = tmdbData.title;
        smallImageText = 'Movie';
      } else if (tmdbData.type === 'tv') {
        details = tmdbData.title + year;
        let episodeInfo = '';
        if (tmdbData.season && tmdbData.episode) {
          episodeInfo = ` • S${tmdbData.season}E${tmdbData.episode}`;
        }
        state = `Watching TV${episodeInfo}`;
        largeImageText = tmdbData.title;
        smallImageText = 'TV Series';
      }
    } else if (mediaUrl) {
      // We detected a watch URL but couldn't fetch TMDB data
      details = mediaUrl.type === 'movie' ? 'Watching a movie' : 'Watching TV';
      state = 'Loading...';
    } else {
      // Not a watch URL, show page info
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        const pathname = urlObj.pathname;
        
        if (hostname === 'seriestechmovies.site' || hostname.includes('seriestechmovies')) {
          if (pathname === '/' || pathname === '') {
            details = 'Series.tech Movies';
            state = 'Browsing';
          } else {
            details = 'Series.tech Movies';
            state = `On ${pathname}`;
          }
        } else {
          details = `Browsing ${hostname}`;
          state = pathname !== '/' ? `On ${pathname}` : '';
        }
      } catch (e) {
        // Invalid URL, use defaults
      }
    }

    rpc.setActivity({
      details: details,
      state: state,
      startTimestamp: presenceStartTime,
      largeImageKey: 'discord_logo', // Asset name uploaded to Discord Developer Portal
      largeImageText: largeImageText,
      smallImageKey: 'discord_logo',
      smallImageText: smallImageText,
      instance: false,
      type: 3, // 3 = WATCHING (0 = PLAYING, 1 = STREAMING, 2 = LISTENING, 3 = WATCHING, 5 = COMPETING)
    });
  } catch (error) {
    console.error('Failed to update Discord Rich Presence:', error.message);
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize ad blocker first
  await initializeAdBlocker();
  
  // Initialize Discord Rich Presence
  await initializeDiscordRPC();
  
  // Then create the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Clean up Discord Rich Presence
  if (rpc) {
    rpc.destroy().catch(() => {});
    rpc = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up Discord Rich Presence on app quit
app.on('before-quit', () => {
  if (rpc) {
    rpc.destroy().catch(() => {});
    rpc = null;
  }
});

