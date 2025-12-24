'use client';

import { Link2, ShieldCheck, AlertTriangle, Heart } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

const features = [
  {
    icon: Link2,
    title: 'Source Traceability',
    description:
      'Click any fact to see exactly where it came from — transcript or document.',
  },
  {
    icon: ShieldCheck,
    title: 'Value Verification',
    description:
      'Critical metrics like LVEF and stenosis grades require explicit confirmation.',
  },
  {
    icon: AlertTriangle,
    title: 'Hallucination Detection',
    description:
      'Secondary AI validates every statement against source material.',
  },
  {
    icon: Heart,
    title: 'Specialty-Aware',
    description:
      'Templates for your specialty — procedure reports, follow-ups, new patient letters.',
  },
];

export function Features() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="features" className="py-20 md:py-32">
      <Container>
        <AnimatedSection className="text-center">
          <h2 className="text-section-title md:text-section-title-lg text-foreground">
            Accuracy you can trust
          </h2>
        </AnimatedSection>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{
                duration: 0.5,
                delay: shouldReduceMotion ? 0 : index * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="group relative rounded-2xl border border-border/60 bg-card p-8 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              {/* Hover accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-primary opacity-0 transition-opacity group-hover:opacity-100" />

              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>

              {/* Content */}
              <h3 className="mt-4 text-heading-2 text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-body-sm text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
