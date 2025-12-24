import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

export function FinalCTA() {
  return (
    <section className="bg-background-subtle py-24">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            Ready to get your evenings back?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Join clinicians across Australia who&apos;ve stopped typing and started
            living.
          </p>

          <div className="mt-10">
            <Button size="lg" asChild>
              <Link href="/signup" className="flex items-center gap-2">
                Start Your Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required. Cancel anytime.
          </p>
        </AnimatedSection>
      </Container>
    </section>
  );
}
