# DictateMED Landing Page Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/landing-page-design-7e67`
- **Spec Document**: `spec.md`

---

## Workflow Steps

### [x] Step: Technical Specification

**Difficulty: HARD**
- 13 landing page sections with specific design requirements
- New route groups (marketing, auth)
- Animation system integration (framer-motion)
- Responsive design across 3 breakpoints
- Auth flow with middleware updates
- ~25 new component files

Created `spec.md` with:
- Technical context and architecture decisions
- Route group structure
- Component organization
- Design system adaptations
- Implementation phases
- Verification approach

---

### [ ] Step: Foundation Setup

Set up the foundation for landing page implementation:

1. Install framer-motion dependency
2. Extend Tailwind config with landing-specific tokens:
   - Hero typography (`text-hero`, `text-hero-lg`)
   - Section typography (`text-section-title`, `text-section-title-lg`)
   - Elevated shadow for product demo
3. Add animation keyframes to globals.css
4. Update middleware to allow public routes (`/`, `/signup`, `/login`, `/forgot-password`)
5. Create route group structures:
   - `(marketing)/layout.tsx` - Clean full-width layout
   - `(auth)/layout.tsx` - Centered card layout
6. Create shared components:
   - `AnimatedSection.tsx` - Scroll-triggered fade-in wrapper
   - `Container.tsx` - Max-width wrapper with padding

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes
- Route groups render correctly

---

### [ ] Step: Navigation Component

Build the sticky navigation with scroll detection:

1. Create `src/components/landing/Navigation.tsx`:
   - Logo text mark ("DictateMED" in primary color)
   - Nav links: Features, Pricing, About (hidden on mobile)
   - CTAs: "Sign In" (ghost), "Start Free Trial" (primary)
   - Mobile hamburger menu with slide-out drawer
2. Implement scroll detection:
   - Transparent initially
   - `bg-white/80 backdrop-blur-xl border-b` when scrolled >20px
3. Ensure fixed positioning with z-index management

**Verification:**
- Navigation renders correctly
- Scroll effect triggers properly
- Mobile menu opens/closes
- Links work (even if pages don't exist yet)

---

### [ ] Step: Hero Section

Build the above-the-fold hero section:

1. Create `src/components/landing/Hero.tsx`:
   - Headline: "Consultation letters that write themselves"
   - Subheadline with founder credibility
   - Primary CTA: "Start Free Trial" with arrow icon
   - Secondary CTA: "Watch 2-min Demo" with play icon
   - Trust indicators row with icons:
     - "< 3 min average review time"
     - "100% source-traceable"
     - "Your data never leaves your country"
2. Implement staggered fade-in-up animation on load
3. Centered layout with generous top padding (pt-32 md:pt-40)

**Verification:**
- Hero captures attention within 3 seconds
- CTAs are visually prominent
- Trust indicators are readable
- Animations respect prefers-reduced-motion

---

### [ ] Step: Social Proof & Problem/Solution Sections

Build sections 3 and 4:

1. Create `src/components/landing/SocialProof.tsx`:
   - "Trusted by clinicians across Australia"
   - Metric badges: "500+ letters", "8+ hours saved", "< 1% error rate"
   - Subtle background, compact height
2. Create `src/components/landing/ProblemSolution.tsx`:
   - Two-column layout (stack on mobile)
   - Left: Pain points with icons
   - Right: Benefits with icons
   - Fade-in on scroll

**Verification:**
- Two-column layout works on desktop
- Stacks properly on mobile
- Scroll animations trigger correctly

---

### [ ] Step: How It Works Section

Build the 3-step process section:

1. Create `src/components/landing/HowItWorks.tsx`:
   - Headline: "Three steps. Three minutes."
   - 3 steps in horizontal layout (vertical on mobile):
     - Step 1: Record (Mic icon)
     - Step 2: Review (CheckCircle icon)
     - Step 3: Send (Send icon)
   - Numbered circles with connecting line
   - Staggered reveal animation (0.1s delay between steps)

**Verification:**
- Steps display correctly across breakpoints
- Connecting line renders properly
- Sequential animation works

---

### [ ] Step: Features Section

Build the key differentiators grid:

1. Create `src/components/landing/Features.tsx`:
   - Headline: "Accuracy you can trust"
   - 2x2 grid of feature cards (1 column on mobile):
     - Source Traceability (Link icon)
     - Value Verification (ShieldCheck icon)
     - Hallucination Detection (AlertTriangle icon)
     - Specialty-Aware (Heart icon)
   - Card design: white bg, rounded-2xl, icon in teal-50 circle
   - Hover effect: lift + teal accent line at bottom

**Verification:**
- Grid layout works across breakpoints
- Hover effects are smooth
- Icons render correctly

---

### [ ] Step: Product Demo & Testimonials Sections

Build sections 7 and 8:

1. Create `src/components/landing/ProductDemo.tsx`:
   - Screenshot placeholder with elevated shadow
   - "See DictateMED in action" caption
   - Device frame mockup styling
2. Create `src/components/landing/Testimonials.tsx`:
   - Headline: "What clinicians are saying"
   - 3 testimonial cards (horizontal scroll on mobile)
   - Quote, author name, specialty, hospital
   - Quote mark decorative icon

**Verification:**
- Product demo section centers properly
- Testimonials scroll horizontally on mobile
- Quote styling looks professional

---

### [ ] Step: Pricing & Security Sections

Build sections 9 and 10:

1. Create `src/components/landing/Pricing.tsx`:
   - Headline: "Simple, transparent pricing"
   - Single pricing card: $99/month, 50 letters
   - Feature list with checkmarks
   - "View full pricing →" link
2. Create `src/components/landing/Security.tsx`:
   - Headline: "Your data stays yours"
   - Trust badges row:
     - Data sovereignty
     - De-identification
     - Local device return
     - No cloud storage
     - Encryption

**Verification:**
- Pricing card renders clearly
- Security badges align properly
- Icons are appropriate

---

### [ ] Step: FAQ & Final CTA Sections

Build sections 11 and 12:

1. Create `src/components/landing/FAQ.tsx`:
   - Collapsible accordion using existing Accordion component
   - 6 FAQ items with questions/answers
   - Plus/minus toggle icons
   - Max-w-3xl centered
2. Create `src/components/landing/FinalCTA.tsx`:
   - Headline: "Ready to get your evenings back?"
   - Subheadline with social proof
   - Large centered CTA button
   - "No credit card required" text

**Verification:**
- Accordion expands/collapses smoothly
- FAQ answers are hidden by default
- Final CTA is visually prominent

---

### [ ] Step: Footer Component

Build the footer section:

1. Create `src/components/landing/Footer.tsx`:
   - Logo
   - Link columns: Features, Pricing, About, Contact, Privacy, Terms
   - "Built by clinicians, for clinicians" tagline
   - Copyright 2025
   - Clean border-top separator

**Verification:**
- Footer renders at page bottom
- Links are organized clearly
- Responsive column layout works

---

### [ ] Step: Landing Page Assembly

Assemble all sections into the landing page:

1. Update `src/app/(marketing)/page.tsx`:
   - Import all 13 section components
   - Compose in correct order
   - Add proper spacing between sections (py-20 md:py-32)
2. Ensure navigation is fixed and doesn't overlap content
3. Test full page scroll experience

**Verification:**
- All sections render in order
- Spacing is consistent
- Scroll experience is smooth
- No layout shift issues

---

### [ ] Step: Auth Pages - Login

Build the login page:

1. Create `src/components/auth/LoginForm.tsx`:
   - Email input with icon
   - Password input with show/hide toggle
   - "Forgot password?" link
   - Submit button with loading state
   - Google SSO option
   - "Don't have account?" link to signup
2. Create `src/app/(auth)/login/page.tsx`:
   - Centered single-column layout
   - Logo at top
   - LoginForm component

**Verification:**
- Form renders correctly
- Password toggle works
- Loading state displays
- Links navigate correctly

---

### [ ] Step: Auth Pages - Signup

Build the signup flow:

1. Create `src/components/auth/SignupForm.tsx`:
   - 2-step flow with progress indicator
   - Step 1: Email, password, continue button
   - Step 2: Name, practice (optional), specialty selector
   - Step transitions with slide animation
   - Google SSO option
2. Create `src/app/(auth)/signup/page.tsx`:
   - Split layout (form left, branding right on desktop)
   - Mobile: form only
   - SignupForm component

**Verification:**
- Step progression works
- Back button returns to step 1
- Form validation works
- Specialty buttons select correctly

---

### [ ] Step: Welcome Modal

Build the onboarding modal:

1. Create `src/components/auth/WelcomeModal.tsx`:
   - 3-step carousel:
     - "Record your consultations" (Mic icon)
     - "AI generates your letter" (Sparkles icon)
     - "Review and send" (Check icon)
   - Progress dots
   - Skip option
   - Final "Start Recording" CTA
2. Integrate into dashboard layout:
   - Detect `?welcome=true` query param
   - Show modal on first load
   - Redirect to /record on completion

**Verification:**
- Modal opens with welcome param
- Steps navigate correctly
- Skip closes modal
- Final CTA redirects to /record

---

### [ ] Step: Final Polish & Verification

Complete final verification:

1. Run full test suite:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
2. Test responsive layouts:
   - Mobile (375px)
   - Tablet (768px)
   - Desktop (1280px+)
3. Test accessibility:
   - Keyboard navigation
   - Screen reader compatibility
   - Reduced motion preference
4. Performance check:
   - Lighthouse audit (target >90)
   - Check FCP (<1.5s)
5. Write completion report to `report.md`

**Verification:**
- All tests pass
- Lighthouse >90
- No console errors
- Auth flow completes successfully
