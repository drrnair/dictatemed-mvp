// src/app/(marketing)/page.tsx
// Landing page - composed of all section components
// Uses ISR to serve static content with periodic revalidation

import { FAQ } from '@/components/landing/FAQ';
import { Features } from '@/components/landing/Features';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Navigation } from '@/components/landing/Navigation';
import { Pricing } from '@/components/landing/Pricing';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { ProductDemo } from '@/components/landing/ProductDemo';
import { Security } from '@/components/landing/Security';
import { SocialProof } from '@/components/landing/SocialProof';
import { Testimonials } from '@/components/landing/Testimonials';

// Revalidate landing page every hour (3600 seconds)
// Content is mostly static but may have minor updates
export const revalidate = 3600;

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
