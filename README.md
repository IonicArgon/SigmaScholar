# SigmaScholar

A Chrome extension and backend system for academic research and scholarly work.

## Project Structure

This repository contains two main components:

### `/extension` - Chrome Extension
The browser extension built with React, TypeScript, and Vite using CRXJS.

**Features:**
- Popup interface for extension controls
- Content scripts for web page interaction
- Firebase integration for data sync

**Development:**
```bash
cd extension
npm install
npm run dev
```

### `/functions` - Firebase Functions Backend
Server-side functions for data processing, authentication, and API integrations.

**Development:**
```bash
cd functions
npm install
npm run serve
```

## Getting Started

1. **Extension Development:**
   ```bash
   cd extension
   npm install
   npm run dev
   ```

2. **Backend Development:**
   ```bash
   cd functions
   npm install
   firebase emulators:start
   ```

3. **Load Extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension/dist` folder

## Tech Stack

- **Frontend:** React, TypeScript, Vite, CRXJS
- **Backend:** Firebase Functions, Node.js
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth

## Contributing

Each folder has its own package.json and development workflow. See individual README files in each directory for specific setup instructions.
