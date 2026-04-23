import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
