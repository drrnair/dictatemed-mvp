# PWA Icons

This directory contains icons for the Progressive Web App (PWA) functionality.

## Required Icons

The following icon sizes are required for full PWA support across all platforms:

### Standard Icons
- `icon-72x72.png` - Small icon
- `icon-96x96.png` - Medium icon
- `icon-128x128.png` - Large icon
- `icon-144x144.png` - Windows tile
- `icon-152x152.png` - iPad
- `icon-192x192.png` - Android home screen
- `icon-384x384.png` - Android splash screen
- `icon-512x512.png` - High-resolution icon

### iOS Specific
- `apple-touch-icon.png` - 180x180 for iOS home screen

### Shortcuts
- `shortcut-record.png` - 96x96 for "New Recording" shortcut
- `shortcut-letters.png` - 96x96 for "Letters" shortcut
- `shortcut-dashboard.png` - 96x96 for "Dashboard" shortcut

## Generating Icons

You can generate all required icons from a single high-resolution source image (ideally 1024x1024 or larger) using one of these methods:

### Option 1: Using ImageMagick (recommended)

```bash
# Install ImageMagick (if not already installed)
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

# Generate all sizes from a source image
convert source.png -resize 72x72 icon-72x72.png
convert source.png -resize 96x96 icon-96x96.png
convert source.png -resize 128x128 icon-128x128.png
convert source.png -resize 144x144 icon-144x144.png
convert source.png -resize 152x152 icon-152x152.png
convert source.png -resize 192x192 icon-192x192.png
convert source.png -resize 384x384 icon-384x384.png
convert source.png -resize 512x512 icon-512x512.png
convert source.png -resize 180x180 apple-touch-icon.png
```

### Option 2: Using Online Tools

1. **Favicon.io** (https://favicon.io)
   - Upload your logo
   - Select "App Icon Generator"
   - Download and extract to this directory

2. **PWA Builder** (https://www.pwabuilder.com/imageGenerator)
   - Upload your source image
   - Download the generated icon pack
   - Extract to this directory

3. **RealFaviconGenerator** (https://realfavicongenerator.net)
   - Most comprehensive option
   - Generates all required sizes and formats
   - Provides preview for all platforms

## Icon Guidelines

### Design Requirements
- **Safe Zone**: Keep important content within the center 80% of the icon
- **Background**: Use solid background or ensure transparency works on all backgrounds
- **Contrast**: Ensure icon is visible on both light and dark backgrounds
- **Simplicity**: Simple, recognizable design works best at small sizes

### Technical Requirements
- Format: PNG with transparency (if applicable)
- Color Space: sRGB
- Bit Depth: 24-bit (or 32-bit with alpha channel)
- Resolution: 72 DPI minimum

### Maskable Icons
For Android adaptive icons, ensure your design works as a "maskable" icon:
- Critical content should be in the center 70% of the canvas
- Use background color to fill safe zone (defined in manifest.json)
- Test with different mask shapes (circle, rounded square, squircle)

## Testing Icons

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Application > Manifest
3. Check all icons are loading correctly
4. View icon previews

### Lighthouse
1. Run Lighthouse audit
2. Check PWA section
3. Verify all icon sizes are present

### Real Devices
- **Android**: Check home screen icon appearance
- **iOS**: Check "Add to Home Screen" icon
- **Desktop**: Check installed app icon in taskbar/dock

## Placeholder Icons

If you don't have custom icons yet, you can use placeholder icons temporarily:

```bash
# Create simple colored placeholders
convert -size 512x512 xc:#1e40af -fill white \
  -font Arial -pointsize 200 -gravity center \
  -annotate +0+0 'DM' icon-512x512.png

# Then resize for other sizes
convert icon-512x512.png -resize 72x72 icon-72x72.png
# ... repeat for all sizes
```

## File Structure

```
public/icons/
├── README.md (this file)
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-384x384.png
├── icon-512x512.png
├── apple-touch-icon.png
├── shortcut-record.png
├── shortcut-letters.png
└── shortcut-dashboard.png
```

## Reference

- [PWA Icon Requirements](https://web.dev/add-manifest/)
- [Apple Touch Icon Guidelines](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Android Adaptive Icons](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)
