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
    // ESLint with auto-fix - allow pre-existing warnings but fail on errors
    'eslint --fix',
    'prettier --write',
  ],

  // JavaScript files in src: lint and format only (no typecheck needed)
  'src/**/*.{js,jsx,mjs,cjs}': ['eslint --fix', 'prettier --write'],

  // JSON, Markdown, YAML: format only
  '**/*.{json,md,yml,yaml}': ['prettier --write'],

  // CSS files: format only
  '**/*.css': ['prettier --write'],
};
