import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: [
    'identity',
    'contentSettings',
  ],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['https://*/*'],
    run_at: 'document_end',
    all_frames: false,
  }],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; worker-src 'self'; connect-src 'self' ws://localhost:* http://localhost:* https://apis.google.com https://www.gstatic.com https://www.googleapis.com https://securetoken.googleapis.com;"
  },
})
