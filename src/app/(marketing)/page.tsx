// src/app/(marketing)/page.tsx
// Landing page - composed of all section components
// Uses ISR to serve static content with periodic revalidation

import { Navigation } from '@/components/landing/Navigation';

// Revalidate landing page every hour (3600 seconds)
// Content is mostly static but may have minor updates
export const revalidate = 3600;
import { Hero } from '@/components/landing/Hero';
import { SocialProof } from '@/components/landing/SocialProof';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Features } from '@/components/landing/Features';
import { ProductDemo } from '@/components/landing/ProductDemo';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { Security } from '@/components/landing/Security';
import { FAQ } from '@/components/landing/FAQ';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <>
      <Navigation />
      <Hero />
      <SocialProof />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <ProductDemo />
      <Testimonials />
      <Pricing />
      <Security />
      <FAQ />
      <FinalCTA />
      <Footer />
    </>
  );
}
