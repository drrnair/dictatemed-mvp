'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

// MVP placeholder testimonials - to be replaced with real feedback
const testimonials = [
  {
    quote:
      'I used to stay 2 hours after clinic. Now I leave with my last patient.',
    name: 'Dr. Sarah M.',
    specialty: 'Cardiologist',
    initials: 'SM',
    color: 'bg-primary',
  },
  {
    quote:
      'The source traceability sold me — I can verify anything in seconds.',
    name: 'Dr. James P.',
    specialty: 'Interventional Cardiologist',
    initials: 'JP',
    color: 'bg-clinical-verified',
  },
  {
    quote:
      'Finally, an AI tool that actually understands cardiology terminology.',
    name: 'Dr. Lisa K.',
    specialty: 'Electrophysiologist',
    initials: 'LK',
    color: 'bg-clinical-info',
  },
];

export function Testimonials() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="bg-background-subtle py-20 md:py-32">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            What clinicians are saying
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Example testimonials - to be replaced with real feedback
          </p>
        </AnimatedSection>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{
                duration: 0.5,
                delay: shouldReduceMotion ? 0 : index * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-card"
            >
              {/* Quote Mark */}
              <Quote className="absolute right-4 top-4 h-8 w-8 text-muted/30" />

              {/* Quote Text */}
              <blockquote className="relative text-body text-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="mt-6 flex items-center gap-3">
                {/* Avatar with Initials */}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white ${testimonial.color}`}
                >
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.specialty}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
