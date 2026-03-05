import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow Next.js to transpile TypeScript source from workspace packages
  transpilePackages: ['@eatme/database'],

  // Increase body size limit for the menu-scan API route.
  // Phone photos resized to 1500px @ 82% JPEG ≈ 300–500 KB base64 each.
  // 10 images max ≈ 5 MB total payload — well within this limit.
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
