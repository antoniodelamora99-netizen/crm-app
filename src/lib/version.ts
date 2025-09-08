// Centralized app version (loaded from package.json)
// Using assert { type: 'json' } works with Next.js + bundler resolution
// Fallback string if import ever fails.
import pkg from '../../package.json';

export const APP_VERSION: string = (pkg as any)?.version || '0.0.0';
