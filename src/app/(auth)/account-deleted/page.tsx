// src/app/(auth)/account-deleted/page.tsx
// Account deleted goodbye page with win-back opportunity

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, ArrowRight, Gift, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountDeletedPage() {
  const [countdown, setCountdown] = useState(15);
  const [showOffer, setShowOffer] = useState(true);

  // Auto-redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to landing page
          window.location.href = '/';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSignOut = () => {
    // Redirect to Auth0 logout
    window.location.href = '/api/auth/logout';
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Main Message */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Heart className="h-8 w-8 text-gray-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            We&apos;re sorry to see you go
          </CardTitle>
          <CardDescription className="text-base text-gray-600">
            Your account has been successfully deleted and all your data has been removed.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Confirmation checklist */}
          <div className="rounded-lg bg-green-50 p-4">
            <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Account deletion completed
            </h3>
            <ul className="text-sm text-green-700 space-y-1 ml-6">
              <li>All recordings removed</li>
              <li>All consultation letters deleted</li>
              <li>Personal data erased</li>
              <li>Preferences cleared</li>
            </ul>
          </div>

          {/* Auto-redirect notice */}
          <p className="text-center text-sm text-gray-500">
            Redirecting to homepage in {countdown} seconds...
          </p>

          {/* Sign out button */}
          <div className="flex justify-center">
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              Sign Out Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Win-back Offer */}
      {showOffer && (
        <Card className="border-2 border-clinical-primary/20 bg-clinical-primary/5 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-clinical-primary" />
                <CardTitle className="text-lg text-gray-900">
                  Changed your mind?
                </CardTitle>
              </div>
              <button
                onClick={() => setShowOffer(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
                aria-label="Dismiss offer"
              >
                Dismiss
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              We&apos;d love to have you back! Sign up again and get a fresh start
              with DictateMED.
            </p>
            <div className="flex gap-3">
              <Link href="/signup" className="flex-1">
                <Button className="w-full bg-clinical-primary hover:bg-clinical-primary/90">
                  Create New Account
                </Button>
              </Link>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Start fresh with our free trial - no commitment required
            </p>
          </CardContent>
        </Card>
      )}

      {/* Footer links */}
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">
          Thank you for trying DictateMED. We hope to see you again!
        </p>
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/" className="text-clinical-primary hover:underline">
            Visit Homepage
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/signup" className="text-clinical-primary hover:underline">
            Sign Up Again
          </Link>
        </div>
      </div>
    </div>
  );
}
