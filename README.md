# Series.tech Movies Browser

A custom browser application built with Electron that focuses on Series.tech Movies site with built-in ad blocking and pop-up blocking.

## Features

- **Custom Browser UI**: Simple interface with URL entry only (no search bar)
- **Default Landing Page**: Automatically loads `seriestechmovies.site` on startup
- **Built-in Ad Blocker**: Uses electron-adblocker to block ads automatically
- **Pop-up Blocker**: Blocks all pop-ups and unwanted windows
- **Direct URL Entry**: Type URLs directly to navigate

## Installation

1. Install dependencies:
```bash
npm install
```

2. Run the application:
```bash
npm start
```

## Building Executable

To build a Windows .exe file:

```bash
npm run build-win
```

The executable will be created in the `dist` folder.

## Requirements

- Node.js (v14 or higher)
- npm or yarn

## Usage

1. Launch the application
2. The default page (seriestechmovies.site) will load automatically
3. Enter any URL in the address bar and click "Go" or press Enter
4. Use Back/Forward buttons for navigation
5. Click Refresh to reload the current page

## Notes

- Pop-ups are automatically blocked
- Ads are automatically blocked using electron-adblocker
- The browser does not include a search bar - only direct URL entry
- All browsing data is stored locally

