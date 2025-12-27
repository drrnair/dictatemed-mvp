/**
 * lint-staged configuration
 *
 * Runs checks on staged files before commit to catch issues early.
 *
 * Order matters:
 * 1. TypeScript type checking (on .ts/.tsx files)
 * 2. ESLint with auto-fix
 * 3. Prettier formatting
 *
 * Note: We run typecheck on the entire project (not just staged files)
 * because TypeScript errors can cascade across files.
 */
module.exports = {
  // TypeScript files in src: typecheck, lint, format
  'src/**/*.{ts,tsx}': [
    // Run typecheck on entire project (TS errors cascade across files)
    () => 'npm run typecheck',
    'eslint --fix --max-warnings=0',
    'prettier --write',
  ],

  // JavaScript files in src: lint and format only (no typecheck needed)
  // Exclude config files at root which ESLint may ignore by default
  'src/**/*.{js,jsx,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],

  // JSON, Markdown, YAML: format only
  '**/*.{json,md,yml,yaml}': ['prettier --write'],

  // CSS files: format only
  '**/*.css': ['prettier --write'],
};
