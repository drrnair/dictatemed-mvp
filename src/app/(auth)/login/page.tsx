// src/app/(auth)/login/page.tsx
// Login page - wrapper for Auth0 Universal Login
// Uses ISR - page shell is static, auth handled client-side

import { LoginForm } from '@/components/auth/LoginForm';

// Revalidate login page every hour (3600 seconds)
// Page content is static - actual auth happens via Auth0 redirect
export const revalidate = 3600;

export default function LoginPage() {
  return <LoginForm />;
}
