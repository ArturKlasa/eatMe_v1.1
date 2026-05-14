import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to the monorepo root. Without this, Next.js
  // 16's Turbopack tries to infer the root from cwd and fails on Vercel when
  // Root Directory is set to apps/admin (it walks up from src/app and can't
  // find next/package.json). path.join('..', '..') resolves to the repo root
  // relative to this config file.
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  transpilePackages: ['@eatme/shared', '@eatme/database', '@eatme/tokens', '@eatme/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
