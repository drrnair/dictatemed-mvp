import { FileText, Clock, CheckCircle } from 'lucide-react';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

const metrics = [
  {
    icon: FileText,
    value: '500+',
    label: 'letters generated',
  },
  {
    icon: Clock,
    value: '8+',
    label: 'hours saved weekly',
  },
  {
    icon: CheckCircle,
    value: '< 1%',
    label: 'error rate',
  },
];

export function SocialProof() {
  return (
    <section className="bg-background-subtle py-8">
      <Container>
        <AnimatedSection>
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Trusted by clinicians across Australia
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center gap-2 text-sm"
                >
                  <metric.icon className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    {metric.value}
                  </span>
                  <span className="text-muted-foreground">{metric.label}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
