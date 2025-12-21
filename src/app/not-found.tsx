// src/app/not-found.tsx
// Custom 404 page for Next.js App Router

'use client';

import Link from 'next/link';
import { FileQuestion, Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
          <FileQuestion
            className="h-10 w-10 text-blue-600"
            aria-hidden="true"
          />
        </div>

        {/* 404 */}
        <div className="mb-4 text-6xl font-bold text-gray-300">404</div>

        {/* Title */}
        <h1 className="mb-3 text-3xl font-bold text-gray-900">
          Page Not Found
        </h1>

        {/* Message */}
        <p className="mb-8 text-gray-600">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Suggestions */}
        <div className="mb-8 rounded-lg bg-white p-6 text-left shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Here are some helpful links:
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              <Link
                href="/dashboard"
                className="flex items-center hover:text-clinical-primary"
              >
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/record"
                className="flex items-center hover:text-clinical-primary"
              >
                <Search className="mr-2 h-4 w-4" />
                Start Recording
              </Link>
            </li>
            <li>
              <Link
                href="/letters"
                className="flex items-center hover:text-clinical-primary"
              >
                <Search className="mr-2 h-4 w-4" />
                View Letters
              </Link>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>

          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-8 text-xs text-gray-400">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
