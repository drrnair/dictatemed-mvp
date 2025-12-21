#!/usr/bin/env node
// scripts/generate-icons.js
// Generates PWA icons as PNG files using sharp

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('Sharp not installed. Installing...');
  const { execSync } = require('child_process');
  execSync('npm install sharp --save-dev', { stdio: 'inherit' });
  sharp = require('sharp');
}

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// Icon sizes needed for PWA
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const APPLE_TOUCH_SIZE = 180;

// DictateMED brand colors
const PRIMARY_COLOR = '#1e40af'; // Blue-800
const BACKGROUND_COLOR = '#ffffff';

// Create SVG logo
function createLogoSVG(size) {
  const padding = Math.floor(size * 0.15);
  const innerSize = size - padding * 2;
  const strokeWidth = Math.max(2, Math.floor(size / 50));

  // Heart with pulse line - medical/cardiology themed
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BACKGROUND_COLOR}" rx="${Math.floor(size * 0.15)}"/>
  <g transform="translate(${padding}, ${padding})">
    <!-- Stylized heart outline -->
    <path
      d="M${innerSize/2} ${innerSize*0.85}
         C${innerSize*0.15} ${innerSize*0.55} ${innerSize*0.05} ${innerSize*0.35} ${innerSize*0.2} ${innerSize*0.2}
         C${innerSize*0.35} ${innerSize*0.1} ${innerSize*0.5} ${innerSize*0.15} ${innerSize/2} ${innerSize*0.3}
         C${innerSize/2} ${innerSize*0.15} ${innerSize*0.65} ${innerSize*0.1} ${innerSize*0.8} ${innerSize*0.2}
         C${innerSize*0.95} ${innerSize*0.35} ${innerSize*0.85} ${innerSize*0.55} ${innerSize/2} ${innerSize*0.85}Z"
      fill="none"
      stroke="${PRIMARY_COLOR}"
      stroke-width="${strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- ECG pulse line through heart -->
    <polyline
      points="${innerSize*0.2},${innerSize*0.5} ${innerSize*0.35},${innerSize*0.5} ${innerSize*0.4},${innerSize*0.35} ${innerSize*0.45},${innerSize*0.6} ${innerSize*0.5},${innerSize*0.4} ${innerSize*0.55},${innerSize*0.55} ${innerSize*0.6},${innerSize*0.5} ${innerSize*0.8},${innerSize*0.5}"
      fill="none"
      stroke="${PRIMARY_COLOR}"
      stroke-width="${strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Letter D for DictateMED -->
    <text
      x="${innerSize/2}"
      y="${innerSize*0.78}"
      font-family="Arial, sans-serif"
      font-size="${innerSize*0.18}"
      font-weight="bold"
      fill="${PRIMARY_COLOR}"
      text-anchor="middle"
    >D</text>
  </g>
</svg>`;
}

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log('Generating PWA icons...\n');

  // Generate standard icons
  for (const size of SIZES) {
    const svgBuffer = Buffer.from(createLogoSVG(size));
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated icon-${size}x${size}.png`);
  }

  // Generate Apple Touch Icon
  const appleSvg = Buffer.from(createLogoSVG(APPLE_TOUCH_SIZE));
  const appleOutputPath = path.join(ICONS_DIR, 'apple-touch-icon.png');

  await sharp(appleSvg)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
    .png()
    .toFile(appleOutputPath);

  console.log(`✓ Generated apple-touch-icon.png (${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE})`);

  // Generate shortcut icons
  const shortcutSize = 96;
  const shortcuts = ['record', 'letters', 'dashboard'];

  for (const shortcut of shortcuts) {
    const svgBuffer = Buffer.from(createLogoSVG(shortcutSize));
    const outputPath = path.join(ICONS_DIR, `shortcut-${shortcut}.png`);

    await sharp(svgBuffer)
      .resize(shortcutSize, shortcutSize)
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated shortcut-${shortcut}.png`);
  }

  // Generate favicon
  const faviconSvg = Buffer.from(createLogoSVG(32));
  const faviconPath = path.join(ICONS_DIR, '..', 'favicon.ico');

  await sharp(faviconSvg)
    .resize(32, 32)
    .png()
    .toFile(faviconPath.replace('.ico', '.png'));

  console.log(`✓ Generated favicon.png`);

  console.log('\n✅ All icons generated successfully!');
  console.log(`   Icons saved to: ${ICONS_DIR}`);
}

generateIcons().catch(console.error);
