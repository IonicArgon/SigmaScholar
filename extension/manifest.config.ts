import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/SigmaScholar_Logo.png',
  },
  action: {
    default_icon: {
      48: 'public/SigmaScholar_Logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: [
    'identity',
    'contentSettings',
    'storage',
  ],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://*.youtube.com/*', 'https://youtube.com/*'],
    run_at: 'document_end',
    all_frames: false,
  }],
  web_accessible_resources: [{
    resources: ['src/pages/onboarding/*', 'src/pages/settings/*'],
    matches: ['<all_urls>']
  }],
  background: {
    service_worker: 'src/background/main.ts'
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; worker-src 'self'; connect-src 'self' ws://localhost:* http://localhost:* https://apis.google.com https://www.gstatic.com https://www.googleapis.com https://securetoken.googleapis.com https://us-central1-sigma-scholar.cloudfunctions.net;"
  },
})
