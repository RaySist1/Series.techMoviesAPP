## Quick Start Guide

### Step 1: Install Node.js
If you don't have Node.js installed, download and install it from https://nodejs.org/ (version 14 or higher)

### Step 2: Install Dependencies
Open PowerShell or Command Prompt in this directory and run:
```
npm install
```

### Step 3: Test the Application
Run the application in development mode:
```
npm start
```

### Step 4: Build the Executable
Once everything works, create the Windows .exe file:
```
npm run build-win
```

The executable will be created in the `dist` folder.

### Troubleshooting

If you encounter any issues:
1. Make sure Node.js is installed: `node --version`
2. Delete `node_modules` folder and `package-lock.json`, then run `npm install` again
3. Check that all files are in the correct location:
   - main.js
   - index.html
   - renderer.js
   - package.json

### Features Included
✅ Custom browser UI with URL entry only (no search bar)
✅ Default landing page: seriestechmovies.site
✅ Built-in ad blocker (electron-adblocker)
✅ Pop-up blocker
✅ Back/Forward navigation
✅ Refresh button

