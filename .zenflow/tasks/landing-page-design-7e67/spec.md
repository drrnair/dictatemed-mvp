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

### Font Update Required
The task specifies **Plus Jakarta Sans** but current codebase uses **Inter**.
- Option A: Keep Inter (already loaded, similar aesthetic)
- Option B: Add Plus Jakarta Sans as secondary font for marketing pages
- **Recommendation:** Keep Inter for consistency with existing app

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

### Removed/Replaced

| File | Action |
|------|--------|
| `src/app/page.tsx` | Remove (replaced by marketing route) |

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

### Auth Flow URLs
- Signup starts new user flow → creates account → redirects to `/dashboard?welcome=true`
- Login authenticates → redirects to `/dashboard`
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
```

### Hero
```typescript
interface HeroProps {
  // No props - content is static
}
// Contains: headline, subheadline, CTAs, trust indicators
```

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

1. Landing page loads in <1.5s (FCP)
2. Lighthouse score >90 for Performance, Accessibility, Best Practices
3. All 13 sections render correctly across breakpoints
4. Scroll animations work smoothly (60fps)
5. Auth flow completes without errors
6. Reduced motion preference is respected
7. All interactive elements have visible focus states
