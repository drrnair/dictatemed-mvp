// src/app/(auth)/signup/page.tsx
// Signup page - wrapper for Auth0 Universal Login with signup hint
// Uses ISR - page shell is static, auth handled client-side

import { SignupForm } from '@/components/auth/SignupForm';

// Revalidate signup page every hour (3600 seconds)
// Page content is static - actual auth happens via Auth0 redirect
export const revalidate = 3600;

export default function SignupPage() {
  return <SignupForm />;
}
