'use client';

/**
 * error.tsx — Next.js App Router per-segment error boundary
 *
 * Catches unhandled errors thrown inside the root segment's page tree
 * (but NOT inside the root layout itself — that's handled by global-error.tsx).
 * Renders an inline fallback card so the navigation shell remains visible.
 *
 * Ref: https://nextjs.org/docs/app/api-reference/file-conventions/error
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RootError] Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600">
            An unexpected error occurred. Your data has not been lost — you can try again or
            refresh the page.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400">Error ID: {error.digest}</p>
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
            <Button onClick={reset} className="bg-orange-600 hover:bg-orange-700">
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
