# PWA Implementation Guide

## Overview

DictateMED is now a fully functional Progressive Web App (PWA) with comprehensive offline capabilities, installable app experience, and automatic updates.

## Features

### Core PWA Features
- **Installable**: Can be installed on desktop and mobile devices
- **Offline Support**: Works offline with queued sync when reconnected
- **Service Worker**: Advanced caching strategies for optimal performance
- **Auto-Updates**: Automatic update detection with user prompts
- **App-like Experience**: Standalone display mode, no browser chrome

### Offline Capabilities
- **Recording Queue**: Recordings made offline are queued and synced when online
- **Static Caching**: UI assets cached for offline access
- **Smart Sync**: Automatic background sync when connection restored
- **Network Detection**: Real-time online/offline status indicators

## Architecture

### Service Worker (`public/sw.js`)

The service worker implements multiple caching strategies:

1. **Network First** (API Calls)
   - Try network first
   - Fall back to cache if offline
   - Update cache with successful responses

2. **Cache First** (Static Assets)
   - Images, fonts, CSS, JS
   - Serve from cache immediately
   - Update cache in background

3. **Stale While Revalidate** (Pages)
   - Serve cached version immediately
   - Update from network in background
   - Best user experience with up-to-date content

4. **Cache Size Management**
   - Automatic LRU (Least Recently Used) eviction
   - Configurable limits per cache type
   - Manual cache clearing available

### Key Components

#### 1. PWA Lifecycle (`src/components/pwa/PWALifecycle.tsx`)
```typescript
// Manages service worker registration
// Handles update prompts
// Controls install prompts
```

#### 2. Update Prompts (`src/components/pwa/UpdatePrompt.tsx`)
- **UpdatePrompt**: Modal dialog for updates
- **UpdateBanner**: Non-intrusive banner
- **InstallPrompt**: PWA installation prompt

#### 3. Offline Indicator (`src/components/layout/OfflineIndicator.tsx`)
- Shows offline status
- Displays queue count
- Network quality indicator

#### 4. PWA Settings (`src/components/pwa/PWASettings.tsx`)
- Cache management
- Update checking
- Cache statistics
- Clear cache functionality

### Hooks

#### `useOnlineStatus()`
```typescript
const { isOnline, networkStatus, isSlowConnection } = useOnlineStatus();
```

#### `useOfflineQueue()`
```typescript
const {
  pendingCount,
  pendingRecordings,
  syncStatus,
  queueRecording,
  syncNow,
} = useOfflineQueue();
```

## Installation

### Prerequisites
1. HTTPS connection (required for service workers)
2. Icons generated (see `public/icons/README.md`)
3. Environment variables configured

### Setup Steps

1. **Enable PWA** (optional in development)
```bash
# .env.local
NEXT_PUBLIC_ENABLE_PWA=true
```

2. **Generate Icons**
See `public/icons/README.md` for icon generation instructions.

3. **Build and Deploy**
```bash
npm run build
npm run start
```

## Configuration

### Manifest (`public/manifest.json`)

Key configurations:
- `start_url`: App entry point
- `display`: "standalone" for app-like experience
- `theme_color`: #1e40af (brand color)
- `icons`: Multiple sizes for all platforms
- `shortcuts`: Quick actions from home screen

### Service Worker Cache Limits

Adjust in `public/sw.js`:
```javascript
const MAX_RUNTIME_ENTRIES = 100;
const MAX_IMAGE_ENTRIES = 60;
const MAX_AUDIO_ENTRIES = 20;
```

### Cache Version

Update to force cache refresh:
```javascript
const CACHE_VERSION = '1.0.0'; // Increment for breaking changes
```

## Usage

### Adding to Home Screen

#### Android (Chrome)
1. Open app in Chrome
2. Tap menu (⋮)
3. Select "Install app" or "Add to Home screen"

#### iOS (Safari)
1. Open app in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Tap "Add"

#### Desktop (Chrome/Edge)
1. Click install icon in address bar
2. Or: Menu > Install DictateMED

### Offline Usage

1. **Recording Offline**
   - Make recordings as normal
   - They're automatically queued
   - Sync happens when online

2. **Viewing Content**
   - Previously viewed pages work offline
   - Static assets cached automatically
   - Offline fallback page shown when needed

3. **Monitoring Status**
   - Offline indicator shows status
   - Queue count displayed
   - Sync progress visible

## Testing

### Local Testing

1. **Enable Service Worker in Dev**
```bash
NEXT_PUBLIC_ENABLE_PWA=true npm run dev
```

2. **Test Offline Mode**
   - Chrome DevTools > Network > Offline
   - Or disable network connection

3. **Lighthouse Audit**
```bash
npm run build
npm run start
# Open Chrome DevTools > Lighthouse > Progressive Web App
```

### PWA Checklist

- [ ] Manifest loads correctly
- [ ] Service worker registers
- [ ] Icons display properly (all sizes)
- [ ] Install prompt appears
- [ ] Offline mode works
- [ ] Update prompt shows for new versions
- [ ] Recordings queue when offline
- [ ] Auto-sync works when online
- [ ] Cache clearing works
- [ ] Shortcuts appear after install

### Browser DevTools

#### Chrome/Edge
1. **Application Tab**
   - Manifest: Check configuration
   - Service Workers: View status, update
   - Cache Storage: Inspect cached files
   - Clear Storage: Reset everything

2. **Network Tab**
   - Filter by "Service Worker"
   - See which requests served from cache

#### Firefox
1. **about:debugging#/runtime/this-firefox**
   - View registered service workers
   - Unregister if needed

### Testing Offline Sync

```javascript
// 1. Make a recording while online
// 2. Go offline (Chrome DevTools > Network > Offline)
// 3. Make another recording (should queue)
// 4. Go back online
// 5. Verify sync happens automatically
```

## Troubleshooting

### Service Worker Not Registering

1. **Check HTTPS**: Service workers require HTTPS (localhost is exempt)
2. **Check Console**: Look for registration errors
3. **Clear Cache**: DevTools > Application > Clear Storage
4. **Hard Refresh**: Ctrl+Shift+R (Cmd+Shift+R on Mac)

### Old Version Stuck

```javascript
// Manually activate new version
navigator.serviceWorker.getRegistration().then(reg => {
  reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
});
```

### Cache Issues

1. **Clear All Caches**
   - Settings > PWA Settings > Clear Cache
   - Or: DevTools > Application > Clear Storage

2. **Force Update**
   - Settings > PWA Settings > Check for Updates

### Offline Queue Not Syncing

1. Check network status indicator
2. Verify IndexedDB has pending items
3. Check browser console for errors
4. Manual sync: `syncNow()` in useOfflineQueue

## Performance

### Cache Sizes

Current limits:
- Runtime cache: 100 entries
- Image cache: 60 entries
- Audio cache: 20 entries

Adjust based on:
- User storage constraints
- Content update frequency
- Offline usage patterns

### Network Strategies

- **Fast**: Cache-first for static assets
- **Fresh**: Network-first for dynamic content
- **Balanced**: Stale-while-revalidate for pages

## Security

### Content Security Policy

Service worker respects CSP headers. Ensure:
- `worker-src 'self'` allows service worker
- `connect-src` includes API endpoints
- `manifest-src 'self'` allows manifest

### Permissions

Required permissions:
- None (PWA doesn't need special permissions)

Optional permissions (for features):
- Microphone: For recording
- Notifications: For sync status updates (future)

## Updates

### Deploying Updates

1. **Increment Cache Version** (for breaking changes)
```javascript
const CACHE_VERSION = '1.0.1'; // public/sw.js
```

2. **Build and Deploy**
```bash
npm run build
# Deploy to production
```

3. **User Experience**
   - Users see update banner
   - Click "Update Now" to apply
   - App reloads with new version

### Update Strategies

- **Minor Updates**: Background update, prompt on next visit
- **Major Updates**: Immediate prompt with banner
- **Critical Updates**: Force update (use with caution)

## Monitoring

### Key Metrics

Track these in analytics:
- Install rate
- Offline usage
- Queue size
- Sync success rate
- Cache hit rate
- Update adoption rate

### Console Logging

Service worker logs all operations:
```
[SW] Service Worker registered
[SW] Cache hit: /dashboard
[SW] Network-first: /api/recordings
[SW] Background sync: recordings
```

## Best Practices

1. **Version Management**
   - Update cache version for breaking changes
   - Test updates thoroughly before deploy

2. **Cache Strategy**
   - Static assets: Cache-first
   - API calls: Network-first
   - Pages: Stale-while-revalidate

3. **User Experience**
   - Non-intrusive update prompts
   - Clear offline indicators
   - Visible sync status

4. **Testing**
   - Test offline mode regularly
   - Verify queue and sync
   - Check all platforms (iOS, Android, Desktop)

5. **Monitoring**
   - Track offline usage
   - Monitor cache sizes
   - Alert on sync failures

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev: PWA](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [PWA Builder](https://www.pwabuilder.com/)

## Support

PWA support by platform:

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Manifest | ✅ | ✅ | ⚠️ | ✅ |
| Install | ✅ | ❌ | ⚠️ | ✅ |
| Shortcuts | ✅ | ❌ | ❌ | ✅ |
| Background Sync | ✅ | ❌ | ❌ | ✅ |

✅ Full support | ⚠️ Partial support | ❌ Not supported

## Future Enhancements

- [ ] Push notifications for sync status
- [ ] Periodic background sync
- [ ] Share target API
- [ ] File handling API
- [ ] Advanced offline features
- [ ] Multi-tab sync
- [ ] Conflict resolution UI
