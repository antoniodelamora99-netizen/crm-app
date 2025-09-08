import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ignore TS and ESLint errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
