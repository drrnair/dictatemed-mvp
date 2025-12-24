# Technical Specification: DictateMED Landing Page

## Overview

Build a conversion-optimized landing page for DictateMED with seamless auth flow integration. The page must capture attention within 3 seconds, build trust through clinical credibility, and convert busy medical professionals to trial signups.

**Difficulty Assessment: HARD**
- 13 distinct page sections with specific design requirements
- New route groups (marketing, auth) requiring architectural decisions
- Animation system integration (framer-motion - new dependency)
- Responsive design across 3 breakpoints with different layouts
- Auth flow integration with middleware updates
- Multiple component files (~20+ new components)
- Performance requirements (Lighthouse >90)

---

## Technical Context

### Framework & Stack
- **Framework:** Next.js 14.2 with App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 3.4 with CSS variables for theming
- **UI Components:** Radix UI primitives + custom components
- **Icons:** Lucide React 0.330
- **Auth:** Auth0 via `@auth0/nextjs-auth0`
- **State:** React hooks (zustand for global state)

### New Dependency Required
```json
"framer-motion": "^11.0.0"
```
Required for scroll-triggered animations, staggered reveals, and page transitions.

### Font Decision: Keep Inter (Deviation from Task Spec)
The task specifies **Plus Jakarta Sans** but we will keep **Inter** for the following reasons:

1. **Consistency**: The authenticated app uses Inter; switching fonts between marketing and app creates visual discontinuity
2. **Performance**: Loading an additional font adds 15-20KB and increases render-blocking time
3. **Visual similarity**: Inter and Plus Jakarta Sans are both geometric sans-serifs with similar x-heights and letter spacing — the difference is subtle
4. **Maintenance**: Single font family reduces design system complexity

**Trade-off acknowledged**: Plus Jakarta Sans has slightly more personality/warmth which could improve marketing appeal. If stakeholder feedback suggests the landing page feels too "clinical," we can revisit this decision.

---

## Architecture Decisions

### Route Group Structure

```
src/app/
├── (marketing)/           # NEW - Public marketing pages
│   ├── layout.tsx         # Clean layout without sidebar
│   └── page.tsx           # Landing page
├── (auth)/                # NEW - Authentication pages
│   ├── layout.tsx         # Centered card layout
│   ├── signup/
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── forgot-password/
│       └── page.tsx
├── (dashboard)/           # EXISTING - Protected app routes
│   └── ...
└── layout.tsx             # Root layout (unchanged)
```

### Public Routes Update
Middleware must be updated to allow public access to new routes:
- `/` - Landing page (change from redirect to marketing page)
- `/signup` - Signup flow
- `/login` - Login page
- `/forgot-password` - Password reset

### Component Organization

```
src/components/
├── landing/               # NEW - Landing page sections
│   ├── Navigation.tsx
│   ├── Hero.tsx
│   ├── SocialProof.tsx
│   ├── ProblemSolution.tsx
│   ├── HowItWorks.tsx
│   ├── Features.tsx
│   ├── ProductDemo.tsx
│   ├── Testimonials.tsx
│   ├── Pricing.tsx
│   ├── Security.tsx
│   ├── FAQ.tsx
│   ├── FinalCTA.tsx
│   └── Footer.tsx
├── auth/                  # NEW - Auth components
│   ├── SignupForm.tsx
│   ├── LoginForm.tsx
│   ├── SocialAuthButton.tsx
│   ├── PasswordInput.tsx
│   └── WelcomeModal.tsx
├── shared/                # NEW - Shared components
│   ├── AnimatedSection.tsx
│   └── Container.tsx
└── ui/                    # EXISTING - Extend as needed
```

---

## Design System Adaptations

### Landing Page Typography (extends existing)
The task specifies larger hero sizes than current design system. Add to Tailwind config:

```js
fontSize: {
  // Landing page specific
  'hero': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
  'hero-lg': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
  'section-title': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
  'section-title-lg': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
}
```

### Color Mapping (task spec → existing)
| Task Spec | Existing Design System |
|-----------|----------------------|
| teal-500 | `primary` (HSL 174 42% 40%) |
| teal-600 hover | `primary/90` |
| slate-50/50 | `background-subtle` |
| slate-900 | `foreground` |
| slate-600 | `muted-foreground` |
| white | `card` |

### Shadow Extensions
Add elevated shadow for product demo section:
```js
boxShadow: {
  'elevated': '0 10px 40px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
}
```

### Animation Keyframes
Add scroll-triggered animation keyframes:
```js
keyframes: {
  'fade-in-up': {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
}
```

---

## Source Code Changes

### New Files

| File | Description |
|------|-------------|
| `src/app/(marketing)/layout.tsx` | Marketing layout (no sidebar, clean) |
| `src/app/(marketing)/page.tsx` | Landing page composing all sections |
| `src/app/(auth)/layout.tsx` | Auth layout (centered card) |
| `src/app/(auth)/signup/page.tsx` | Two-step signup flow |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/forgot-password/page.tsx` | Password reset |
| `src/components/landing/*.tsx` | 13 landing page section components |
| `src/components/auth/*.tsx` | 5 auth-related components |
| `src/components/shared/*.tsx` | 2 shared utility components |

### Modified Files

| File | Changes |
|------|---------|
| `src/middleware.ts` | Add `/signup`, `/login`, `/forgot-password` to public routes |
| `tailwind.config.js` | Add landing-specific typography and shadow extensions |
| `src/app/globals.css` | Add landing-specific animation keyframes |
| `package.json` | Add `framer-motion` dependency |

### Deleted Files

| File | Reason |
|------|--------|
| `src/app/page.tsx` | **MUST DELETE** — This file currently redirects to `/dashboard`. Since Next.js route groups don't affect URL structure, both `src/app/page.tsx` and `src/app/(marketing)/page.tsx` would resolve to `/`, causing a conflict. The existing file must be deleted, not just replaced. |

---

## Implementation Approach

### Phase 1: Foundation
1. Install framer-motion dependency
2. Update Tailwind config with landing-specific tokens
3. Update middleware for public routes
4. Create route group structures with layouts

### Phase 2: Landing Page Sections
Build sections in order (top to bottom):
1. Navigation (sticky header with scroll detection)
2. Hero (headline, CTAs, trust indicators)
3. SocialProof (metric badges)
4. ProblemSolution (two-column layout)
5. HowItWorks (3-step process)
6. Features (2x2 grid of differentiators)
7. ProductDemo (screenshot/mockup placeholder)
8. Testimonials (3-card grid)
9. Pricing (single tier preview)
10. Security (trust badges)
11. FAQ (accordion)
12. FinalCTA (closing conversion section)
13. Footer

### Phase 3: Auth Pages
1. SignupForm (2-step flow with progress)
2. LoginForm
3. WelcomeModal (onboarding carousel)
4. Password reset page

### Phase 4: Integration & Polish
1. Animation tuning (stagger timing, viewport triggers)
2. Responsive testing across breakpoints
3. Accessibility audit (focus states, ARIA, reduced motion)
4. Performance optimization (lazy loading, image optimization)

---

## API & Interface Changes

### No Backend Changes Required
The landing page is entirely frontend. Auth flows use existing Auth0 integration.

### Middleware Update
```typescript
const publicPaths = [
  '/',                     // Now serves landing page
  '/signup',               // NEW
  '/login',                // NEW
  '/forgot-password',      // NEW
  '/api/auth',
  '/api/health',
  // ... existing paths
];
```

### Auth0 Integration Strategy

The current codebase uses Auth0's Universal Login (redirects to Auth0-hosted login page). For the custom `/login` and `/signup` pages, we have two options:

**Option A: Wrapper Pages (Recommended)**
- `/login` and `/signup` are branded landing pages with CTAs
- Clicking "Sign In" or "Sign Up" redirects to Auth0's Universal Login (`/api/auth/login`)
- Auth0 handles the actual authentication
- After auth, Auth0 redirects back to `/dashboard` (or `/dashboard?welcome=true` for new users)

**Option B: Embedded Login (Not Recommended)**
- Custom forms that call Auth0 APIs directly
- Requires Auth0 "Custom Domains" and additional configuration
- More complex, higher security surface area
- Not recommended for MVP

**Chosen approach: Option A (Wrapper Pages)**

The custom `/login` and `/signup` pages will:
1. Display branded UI with value propositions
2. Provide "Continue with Google" and "Continue with Email" buttons
3. Both buttons redirect to `/api/auth/login` (existing Auth0 flow)
4. Auth0 `returnTo` parameter controls post-login destination

For signup vs login distinction:
- `/signup` → `/api/auth/login?screen_hint=signup&returnTo=/dashboard?welcome=true`
- `/login` → `/api/auth/login?returnTo=/dashboard`

This requires Auth0 to be configured with "New Universal Login" experience (supports `screen_hint`).

### Auth Flow URLs
- "Start Free Trial" → `/signup` → Auth0 Universal Login (signup mode) → `/dashboard?welcome=true`
- "Sign In" → `/login` → Auth0 Universal Login (login mode) → `/dashboard`
- Dashboard layout detects `?welcome=true` and shows onboarding modal

---

## Verification Approach

### Automated Checks
```bash
npm run lint          # ESLint checks
npm run typecheck     # TypeScript compilation
npm run test          # Unit tests (add tests for new components)
```

### Manual Verification
1. **Responsive Testing**
   - Mobile (375px): Single column, hamburger nav, touch-friendly
   - Tablet (768px): Adapted layouts, readable spacing
   - Desktop (1280px): Full layouts with proper grid

2. **Animation Testing**
   - Scroll animations trigger at correct viewport positions
   - Stagger timing feels natural (100-150ms between elements)
   - Respects `prefers-reduced-motion` media query

3. **Accessibility Checklist**
   - Keyboard navigation works throughout
   - Focus states visible on all interactive elements
   - Screen reader announces content correctly
   - Color contrast meets WCAG AA (4.5:1 for text)

4. **Performance**
   - Run Lighthouse audit (target: >90)
   - Check First Contentful Paint (<1.5s)
   - Verify no layout shift (CLS < 0.1)

5. **Conversion Flow**
   - "Start Free Trial" → `/signup` works
   - "Sign In" → `/login` works
   - Signup completes → redirects to dashboard with welcome modal

---

## Component Contracts

### AnimatedSection (shared utility)
```typescript
interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  animation?: 'fade-up' | 'fade' | 'slide-left' | 'slide-right';
}
```

### Navigation
```typescript
interface NavigationProps {
  // No props - self-contained with scroll detection
}
// Internal state: scrolled (boolean) for blur effect
// Internal state: mobileMenuOpen (boolean) for hamburger menu
```

**Mobile Menu Implementation:**
- Use Radix `Dialog` component for accessible modal behavior
- Slide-in from right (transform: translateX)
- Close triggers: outside click, escape key, close button, link click
- Focus trap while open
- Animate with framer-motion (0.2s ease-out)

```typescript
// Mobile menu structure
<Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
  <DialogContent className="fixed inset-y-0 right-0 w-[80%] max-w-sm">
    {/* Nav links */}
    {/* CTAs */}
  </DialogContent>
</Dialog>
```

### Hero
```typescript
interface HeroProps {
  // No props - content is static
}
// Contains: headline, subheadline, CTAs, trust indicators
```

### ProductDemo
**Chosen approach: Video Embed (Option B)**

For MVP simplicity, we'll implement a video embed placeholder:
- Tasteful thumbnail with centered play button
- "See DictateMED in action (2 min)" caption
- Rounded corners (rounded-2xl), elevated shadow
- On click: opens video in modal (or links to external video)

**MVP implementation:** Static placeholder image with play button overlay. The actual video can be added later when product demo video is recorded.

```typescript
interface ProductDemoProps {
  videoUrl?: string;  // Optional - shows placeholder if not provided
  thumbnailUrl?: string;  // Optional - shows gradient placeholder if not provided
}
```

**Future enhancements** (not in MVP):
- Option A: Animated product mockup with typing effect
- Option C: Screenshot carousel with dot indicators

### FAQ
```typescript
interface FAQItem {
  question: string;
  answer: string;
}
// Uses existing Accordion component
```

### SignupForm
```typescript
interface SignupFormProps {
  // No props - self-contained 2-step form
}
// Internal state: step (1 | 2), form values, loading, errors
```

### WelcomeModal
```typescript
interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}
// 3-step onboarding carousel
```

**State Persistence Strategy:**
The welcome modal should only show once per user. Implementation:

1. **Trigger**: Dashboard layout checks for `?welcome=true` query param
2. **Display**: If param present, show modal and remove param from URL (using `router.replace`)
3. **Persistence**: No additional persistence needed — the query param is only set once during signup redirect
4. **Skip behavior**: Clicking "Skip" or completing the flow both close the modal
5. **No database flag needed**: The param-based approach is stateless and doesn't require backend changes

**Dashboard Layout Integration:**
```typescript
// In src/app/(dashboard)/layout.tsx (or a client component within)
'use client';
import { useSearchParams, useRouter } from 'next/navigation';

function WelcomeModalTrigger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showWelcome = searchParams.get('welcome') === 'true';

  const handleClose = () => {
    // Remove query param without page reload
    router.replace('/dashboard', { scroll: false });
  };

  return <WelcomeModal isOpen={showWelcome} onClose={handleClose} />;
}
```

---

## Image & Asset Strategy

### Asset Storage
- All marketing images stored in `public/images/landing/`
- Use Next.js `Image` component for automatic optimization
- Specify width/height to prevent layout shift

### Placeholder Strategy (MVP)
Since actual product screenshots and testimonial photos may not be available:

| Asset | Placeholder Approach |
|-------|---------------------|
| Product demo thumbnail | Gradient background (teal to blue) with abstract UI elements |
| Testimonial photos | Initials in colored circles (no fake photos) |
| Hero visual | Abstract geometric shapes or waveform visualization |
| Device frames | CSS-only device frame styling |

### Image Specifications
```
Hero visual: 800x600px (or SVG)
Product demo: 1200x800px (16:10 ratio)
Testimonial avatars: 48x48px (rendered as initials for MVP)
```

### Testimonial Content (MVP)
The example testimonials in the task spec will be used as **clearly fictional placeholders**:
- Mark with "Example testimonials - to be replaced with real feedback"
- Use generic names: "Dr. Sarah M.", "Dr. James P."
- Include specialty but omit hospital names
- These are for layout/design purposes only and should be replaced before public launch

---

## Risk Mitigation

### Performance Risks
- **Large animation library:** framer-motion adds ~40KB. Mitigate by using dynamic imports for landing page only.
- **Image-heavy sections:** Use Next.js Image component with lazy loading and WebP format.

### Accessibility Risks
- **Animation overload:** Always check `prefers-reduced-motion` and disable or reduce animations.
- **Focus management:** Test keyboard navigation thoroughly, especially in modals and forms.

### Conversion Risks
- **CTA clarity:** Ensure primary CTA is visually dominant and clear.
- **Trust signals:** Place near CTAs to reduce friction.

---

## Success Criteria

### Performance
1. Lighthouse score >90 for Performance, Accessibility, Best Practices
2. Core Web Vitals:
   - LCP (Largest Contentful Paint): < 2.5s
   - FID (First Input Delay): < 100ms
   - CLS (Cumulative Layout Shift): < 0.1
3. First Contentful Paint: < 1.5s
4. Scroll animations run at 60fps (no jank)

### Functionality
5. All 13 sections render correctly across breakpoints (375px, 768px, 1280px+)
6. Auth flow completes: Landing → Signup → Auth0 → Dashboard with welcome modal
7. All CTAs link to correct destinations
8. Mobile navigation opens/closes correctly

### Accessibility
9. Reduced motion preference is respected (`prefers-reduced-motion`)
10. All interactive elements have visible focus states
11. Keyboard navigation works throughout
12. Color contrast meets WCAG AA (4.5:1 for text)
