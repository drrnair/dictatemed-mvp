import {
  Clock,
  Home,
  MessageSquare,
  Stethoscope,
  Mic,
  Link2,
  Sparkles,
  Heart,
} from 'lucide-react';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

const painPoints = [
  {
    icon: Clock,
    text: '15-20 minutes per letter, multiplied by 20 patients',
  },
  {
    icon: Home,
    text: 'After-hours charting stealing family time',
  },
  {
    icon: MessageSquare,
    text: 'Typing while patients talk — missing context',
  },
  {
    icon: Stethoscope,
    text: "Generic AI tools that don't understand cardiology",
  },
];

const benefits = [
  {
    icon: Mic,
    text: 'Speak naturally, letters appear',
  },
  {
    icon: Link2,
    text: 'Every fact traced to its source',
  },
  {
    icon: Sparkles,
    text: 'Your style, learned and replicated',
  },
  {
    icon: Heart,
    text: 'Built specifically for cardiology workflows',
  },
];

export function ProblemSolution() {
  return (
    <section className="py-20 md:py-32">
      <Container>
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          {/* Problem Column */}
          <AnimatedSection animation="slide-right" className="space-y-6">
            <h2 className="text-section-title md:text-section-title-lg text-foreground">
              Documentation shouldn&apos;t follow you home
            </h2>
            <ul className="space-y-4">
              {painPoints.map((point) => (
                <li
                  key={point.text}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <point.icon className="mt-0.5 h-5 w-5 shrink-0 text-destructive/70" />
                  <span>{point.text}</span>
                </li>
              ))}
            </ul>
          </AnimatedSection>

          {/* Solution Column */}
          <AnimatedSection animation="slide-left" delay={0.1} className="space-y-6">
            <h2 className="text-section-title md:text-section-title-lg text-foreground">
              There&apos;s a better way
            </h2>
            <ul className="space-y-4">
              {benefits.map((benefit) => (
                <li
                  key={benefit.text}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <benefit.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{benefit.text}</span>
                </li>
              ))}
            </ul>
          </AnimatedSection>
        </div>
      </Container>
    </section>
  );
}
