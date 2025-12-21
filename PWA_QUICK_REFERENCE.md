# PWA Quick Reference

## File Locations

```
dictatemed-mvp/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (enhanced)
│   ├── offline.html           # Offline fallback page
│   └── icons/                 # PWA icons directory
│       ├── README.md          # Icon generation guide
│       └── .gitkeep           # Placeholder
├── src/
│   ├── app/
│   │   └── layout.tsx         # Updated with PWA metadata
│   ├── components/
│   │   ├── pwa/
│   │   │   ├── PWALifecycle.tsx    # Registration & prompts
│   │   │   ├── UpdatePrompt.tsx    # Update UI components
│   │   │   └── PWASettings.tsx     # Settings panel
│   │   └── layout/
│   │       └── OfflineIndicator.tsx # Enhanced with queue
│   ├── hooks/
│   │   ├── useOnlineStatus.ts      # Online/offline status
│   │   └── useOfflineQueue.ts      # Existing (no changes)
│   └── lib/
│       └── pwa.ts                   # PWA utilities
├── next.config.js             # Updated with PWA headers
└── docs/
    └── PWA_IMPLEMENTATION.md  # Full documentation
```

## Quick Commands

```bash
# Enable PWA in development
NEXT_PUBLIC_ENABLE_PWA=true npm run dev

# Production build and test
npm run build && npm run start

# Generate placeholder icons (requires ImageMagick)
cd public/icons
convert -size 512x512 xc:#1e40af -fill white \
  -font Arial -pointsize 200 -gravity center \
  -annotate +0+0 'DM' icon-512x512.png

# Resize to all sizes
for size in 72 96 128 144 152 192 384 512; do
  convert icon-512x512.png -resize ${size}x${size} icon-${size}x${size}.png
done
convert icon-512x512.png -resize 180x180 apple-touch-icon.png
cp icon-96x96.png shortcut-{record,letters,dashboard}.png
```

## Component Usage

### Show offline indicator
```tsx
import { OfflineIndicator } from '@/components/layout/OfflineIndicator';
<OfflineIndicator />
```

### Use online status
```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
const { isOnline, networkStatus } = useOnlineStatus();
```

### Queue offline operations
```tsx
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
const { queueRecording, pendingCount } = useOfflineQueue();
```

### Add PWA settings
```tsx
import { PWASettings } from '@/components/pwa/PWASettings';
<PWASettings />
```

## Testing Checklist

- [ ] Service worker registers (DevTools > Application)
- [ ] Manifest loads (DevTools > Application > Manifest)
- [ ] Install prompt appears
- [ ] Offline mode works (DevTools > Network > Offline)
- [ ] Recordings queue when offline
- [ ] Auto-sync when back online
- [ ] Update prompt shows for new versions
- [ ] Cache clearing works
- [ ] Icons display correctly

## Browser DevTools

**Chrome/Edge:**
- `F12` → Application → Service Workers
- Application → Manifest (check icons)
- Application → Cache Storage (inspect caches)
- Network → Offline (test offline mode)

**Clear Everything:**
- Application → Clear Storage → Clear site data

## Common Issues

**Service worker not registering:**
- Check HTTPS (or localhost)
- Clear cache: DevTools > Application > Clear Storage
- Hard refresh: Ctrl+Shift+R

**Old version stuck:**
- DevTools > Application > Service Workers > Unregister
- Clear Storage
- Hard refresh

**Icons not showing:**
- Check `public/icons/` directory exists
- Verify icon files exist and correct sizes
- Check manifest.json paths

## Cache Version Management

Update `public/sw.js`:
```javascript
const CACHE_VERSION = '1.0.0'; // Increment for updates
```

Increment when:
- Major UI changes
- Service worker logic changes
- Force cache refresh needed

## Environment Variables

```bash
# .env.local

# Enable PWA in development (optional)
NEXT_PUBLIC_ENABLE_PWA=true
```

## Deployment Requirements

1. **HTTPS** (required for service workers)
2. **Icons** (all sizes generated)
3. **Build** (`npm run build`)
4. **Headers** (next.config.js handles this)

## Key Features

✅ Installable app (Chrome, Edge, Android, iOS*)
✅ Offline support with queue
✅ Auto-sync when reconnected
✅ Update prompts
✅ Cache management
✅ Network status detection
✅ Beautiful offline page

*iOS has partial support - works but less prominent

## No New Dependencies!

All functionality uses:
- ✅ `idb` (already in package.json)
- ✅ `lucide-react` (already in package.json)
- ✅ Native browser APIs

## Next Steps

1. Generate production icons (see `public/icons/README.md`)
2. Test on all target devices
3. Deploy to production with HTTPS
4. Monitor install and usage metrics

## Resources

- Full docs: `docs/PWA_IMPLEMENTATION.md`
- Icon guide: `public/icons/README.md`
- Setup summary: `PWA_SETUP_SUMMARY.md`
