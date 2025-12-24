// src/app/(auth)/layout.tsx
// Auth layout - centered card layout for login/signup pages

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-subtle p-6">
      <main id="main-content" className="w-full max-w-4xl">
        {children}
      </main>
    </div>
  );
}
