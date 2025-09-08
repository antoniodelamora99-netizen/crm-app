import type { NextConfig } from 'next;/
const nextConfig: NextConfig = {
  // Ignore TS and ESLint errors during build when ALLOW_UNTYPED_BUILD=1
  typescript: {
    ignoreBuildErrors: process.env.ALLOW_UNTYPED_BUILD === '1',
  },
  eslint: {
    ignoreDuringBuilds: process.env.ALLOW_UNTYPED_BUILD === '1',
  },
};

export default nextConfig;
