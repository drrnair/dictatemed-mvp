import Link from 'next/link';
import { Check } from 'lucide-react';
import { SocialAuthButton } from './SocialAuthButton';

const benefits = [
  'Document consultations in minutes',
  'Every fact traced to its source',
  'Your style, learned and replicated',
  'No credit card required',
];

export function SignupForm() {
  // Auth0 signup URLs with welcome param for onboarding modal
  // Note: returnTo value should be URL-encoded when it contains query params
  const returnTo = encodeURIComponent('/dashboard?welcome=true');
  const googleSignupUrl = `/api/auth/login?screen_hint=signup&connection=google-oauth2&returnTo=${returnTo}`;
  const emailSignupUrl = `/api/auth/login?screen_hint=signup&returnTo=${returnTo}`;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-16">
      {/* Value Props (left side on desktop) */}
      <div className="lg:flex-1">
        <Link href="/" className="text-2xl font-semibold text-primary">
          DictateMED
        </Link>

        <h1 className="mt-6 text-section-title md:text-section-title-lg text-foreground">
          Get your evenings back
        </h1>

        <p className="mt-4 text-lg text-muted-foreground">
          Join clinicians across Australia who&apos;ve stopped typing and started
          living.
        </p>

        <ul className="mt-8 space-y-3">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-foreground">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Signup Form (right side on desktop) */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card lg:w-96">
        <div className="text-center">
          <h2 className="text-heading-2 text-foreground">Start free trial</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            14 days free, no credit card required
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <SocialAuthButton provider="google" href={googleSignupUrl} />
          <SocialAuthButton provider="email" href={emailSignupUrl} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>

        <div className="mt-6 border-t pt-6">
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
