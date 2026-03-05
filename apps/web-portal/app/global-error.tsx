'use client';

/**
 * global-error.tsx — Next.js App Router root error boundary
 *
 * Catches unhandled errors thrown anywhere in the React tree, including
 * inside the root layout. Must be a Client Component and must render its
 * own <html>/<body> since the root layout is bypassed when this fires.
 *
 * Ref: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production
    console.error('[GlobalError] Unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#111',
              marginBottom: '0.5rem',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#666',
              marginBottom: '0.25rem',
            }}
          >
            An unexpected error occurred in the EatMe portal.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1.5rem' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.5rem',
              backgroundColor: '#ea580c',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
