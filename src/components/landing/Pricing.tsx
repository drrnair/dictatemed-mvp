import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

const features = [
  '50 letters included',
  'All features included',
  'Source traceability',
  'Hallucination detection',
  'Specialty templates',
  'Priority support',
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-32">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            Simple, transparent pricing
          </h2>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mx-auto mt-12 max-w-md">
          <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-card">
            {/* Price */}
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Specialist Plan
              </p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-foreground">$99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Start free for 14 days
              </p>
            </div>

            {/* Features */}
            <ul className="mt-8 space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span className="text-body-sm text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Button asChild className="mt-8 w-full" size="lg">
              <Link href="/signup" className="flex items-center justify-center gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Volume discounts for practices.{' '}
            <a
              href="mailto:hello@dictatemed.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              Contact us
            </a>
          </p>
        </AnimatedSection>
      </Container>
    </section>
  );
}
