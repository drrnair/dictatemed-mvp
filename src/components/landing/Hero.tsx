'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Play, Clock, Link2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/shared/Container';

const trustIndicators = [
  {
    icon: Clock,
    text: '< 3 min average review time',
  },
  {
    icon: Link2,
    text: '100% source-traceable',
  },
  {
    icon: Shield,
    text: 'Your data never leaves your country',
  },
];

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
      <Container>
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="mx-auto max-w-4xl text-center"
        >
          {/* Headline */}
          <motion.h1
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-hero md:text-hero-lg text-foreground"
          >
            Consultation letters that write themselves
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="mx-auto mt-6 max-w-2xl text-xl text-muted-foreground md:text-2xl"
          >
            DictateMED captures your consultations and generates accurate,
            source-verified letters in your exact writing style.{' '}
            <span className="text-foreground">
              Built by a clinician who was tired of typing.
            </span>
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/signup" className="flex items-center gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              asChild
            >
              <a href="#demo" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Watch 2-min Demo
              </a>
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-12 flex flex-col items-center justify-center gap-6 text-sm text-muted-foreground sm:flex-row sm:gap-8"
          >
            {trustIndicators.map((indicator) => (
              <div
                key={indicator.text}
                className="flex items-center gap-2"
              >
                <indicator.icon className="h-4 w-4 text-primary" />
                <span>{indicator.text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
