import { Globe, Shield, Smartphone, ServerOff, Lock } from 'lucide-react';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

const trustBadges = [
  {
    icon: Globe,
    text: 'Data never leaves your country',
  },
  {
    icon: Shield,
    text: 'De-identified during processing',
  },
  {
    icon: Smartphone,
    text: 'Returns to your local device',
  },
  {
    icon: ServerOff,
    text: 'Zero cloud storage of recordings',
  },
  {
    icon: Lock,
    text: 'Encrypted in transit',
  },
];

export function Security() {
  return (
    <section className="bg-background-subtle py-20 md:py-32">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            Your data stays yours
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Enterprise-grade privacy, wherever you practice
          </p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="mt-12">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {trustBadges.map((badge) => (
              <div
                key={badge.text}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <badge.icon className="h-5 w-5" />
                <span>{badge.text}</span>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
