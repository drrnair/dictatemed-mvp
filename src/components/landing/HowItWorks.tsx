'use client';

import { Mic, CheckCircle, Send } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

const steps = [
  {
    number: 1,
    icon: Mic,
    title: 'Record',
    description:
      'Start your consultation naturally. DictateMED captures everything — ambient or dictated.',
  },
  {
    number: 2,
    icon: CheckCircle,
    title: 'Review',
    description:
      'AI generates your letter with every clinical fact linked to its source. Verify critical values with one click.',
  },
  {
    number: 3,
    icon: Send,
    title: 'Send',
    description:
      'Approve and send. Your letter, your style, your signature.',
  },
];

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="bg-background-subtle py-20 md:py-32">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            Three steps. Three minutes.
          </h2>
        </AnimatedSection>

        <div className="relative mt-16">
          {/* Connecting Line (desktop only) */}
          <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-border md:block" />

          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{
                  duration: 0.5,
                  delay: shouldReduceMotion ? 0 : index * 0.1,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Step Number Circle */}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm">
                    <step.icon className="h-7 w-7 text-primary" />
                  </div>
                </div>

                {/* Step Number Badge */}
                <div className="absolute -top-2 right-1/2 z-20 flex h-6 w-6 translate-x-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {step.number}
                </div>

                {/* Content */}
                <div className="mt-6 space-y-2">
                  <h3 className="text-heading-2 text-foreground">{step.title}</h3>
                  <p className="mx-auto max-w-xs text-body-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
