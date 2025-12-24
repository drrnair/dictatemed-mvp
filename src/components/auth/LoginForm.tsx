import Link from 'next/link';
import { SocialAuthButton } from './SocialAuthButton';

export function LoginForm() {
  // Auth0 login URLs
  const googleLoginUrl = '/api/auth/login?connection=google-oauth2&returnTo=/dashboard';
  const emailLoginUrl = '/api/auth/login?returnTo=/dashboard';

  return (
    <div className="w-full space-y-6">
      {/* Logo */}
      <div className="text-center">
        <Link href="/" className="text-2xl font-semibold text-primary">
          DictateMED
        </Link>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-heading-1 text-foreground">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to continue to your dashboard
        </p>
      </div>

      {/* Auth Buttons */}
      <div className="space-y-3">
        <SocialAuthButton provider="google" href={googleLoginUrl} />
        <SocialAuthButton provider="email" href={emailLoginUrl} />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
      </div>

      {/* Sign Up Link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline"
        >
          Start free trial
        </Link>
      </p>
    </div>
  );
}
