import { Play } from 'lucide-react';
import { Container } from '@/components/shared/Container';
import { AnimatedSection } from '@/components/shared/AnimatedSection';

interface ProductDemoProps {
  videoUrl?: string;
  thumbnailUrl?: string;
}

export function ProductDemo({ videoUrl, thumbnailUrl }: ProductDemoProps) {
  // For MVP, we show a placeholder. The actual video/thumbnail can be added later.
  const hasVideo = !!videoUrl;

  return (
    <section id="demo" className="py-20 md:py-32">
      <Container>
        <AnimatedSection className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-2xl shadow-elevated">
            {/* Device Frame */}
            <div className="bg-muted p-2 md:p-3">
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-2 pb-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-clinical-warning/60" />
                  <div className="h-3 w-3 rounded-full bg-clinical-verified/60" />
                </div>
                <div className="ml-4 flex-1 rounded bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  app.dictatemed.com
                </div>
              </div>

              {/* Video/Placeholder Area */}
              {hasVideo ? (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary/20 to-primary/5"
                >
                  {thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt="DictateMED product demo"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110">
                      <Play className="h-6 w-6 translate-x-0.5" />
                    </div>
                  </div>
                </a>
              ) : (
                /* Placeholder for MVP - shows abstract UI mockup */
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-accent">
                  {/* Abstract UI placeholder elements */}
                  <div className="absolute inset-4 flex flex-col gap-3 opacity-40">
                    <div className="h-8 w-32 rounded bg-foreground/20" />
                    <div className="flex flex-1 gap-4">
                      <div className="flex-1 rounded-lg bg-foreground/10 p-4">
                        <div className="space-y-2">
                          <div className="h-3 w-full rounded bg-foreground/20" />
                          <div className="h-3 w-4/5 rounded bg-foreground/20" />
                          <div className="h-3 w-3/4 rounded bg-foreground/20" />
                          <div className="h-3 w-full rounded bg-foreground/20" />
                          <div className="h-3 w-2/3 rounded bg-foreground/20" />
                        </div>
                      </div>
                      <div className="w-64 rounded-lg bg-foreground/10 p-4">
                        <div className="space-y-2">
                          <div className="h-3 w-full rounded bg-foreground/20" />
                          <div className="h-3 w-3/4 rounded bg-foreground/20" />
                          <div className="mt-4 h-8 w-full rounded bg-foreground/15" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* "Coming Soon" overlay instead of play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm">
                      Demo video coming soon
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {hasVideo ? 'See DictateMED in action (2 min)' : 'Product walkthrough coming soon'}
          </p>
        </AnimatedSection>
      </Container>
    </section>
  );
}
